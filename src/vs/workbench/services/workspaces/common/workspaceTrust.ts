/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from 'vs/base/common/codicons';
import { Emitter } from 'vs/base/common/event';
import { MarkdownString } from 'vs/base/common/htmlContent';
import { splitName } from 'vs/base/common/labels';
import { Disposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { LinkedList } from 'vs/base/common/linkedList';
import { Schemas } from 'vs/base/common/network';
import { isWeb } from 'vs/base/common/platform';
import Severity from 'vs/base/common/severity';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKey, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { WorkspaceTrustRequestOptions, IWorkspaceTrustManagementService, IWorkspaceTrustInfo, IWorkspaceTrustUriInfo, IWorkspaceTrustRequestService, IWorkspaceTrustTransitionParticipant, WorkspaceTrustUriResponse } from 'vs/platform/workspace/common/workspaceTrust';
import { isSingleFolderWorkspaceIdentifier, isUntitledWorkspace, toWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { Memento, MementoObject } from 'vs/workbench/common/memento';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';

export const WORKSPACE_TRUST_ENABLED = 'security.workspace.trust.enabled';
export const WORKSPACE_TRUST_STARTUP_PROMPT = 'security.workspace.trust.startupPrompt';
export const WORKSPACE_TRUST_UNTRUSTED_FILES = 'security.workspace.trust.untrustedFiles';
export const WORKSPACE_TRUST_EMPTY_WINDOW = 'security.workspace.trust.emptyWindow';
export const WORKSPACE_TRUST_EXTENSION_SUPPORT = 'extensions.supportUntrustedWorkspaces';
export const WORKSPACE_TRUST_STORAGE_KEY = 'content.trust.model.key';
export const WORKSPACE_TRUST_NON_WORKSPACE_FILES_DECISION_KEY = 'security.workspace.trust.nonWorkspaceFiles';

export const WorkspaceTrustContext = {
	IsTrusted: new RawContextKey<boolean>('isWorkspaceTrusted', false, localize('workspaceTrustCtx', "Whether the current workspace has been trusted by the user."))
};

export function isWorkspaceTrustEnabled(configurationService: IConfigurationService): boolean {
	if (isWeb) {
		return false;
	}

	return (configurationService.inspect<boolean>(WORKSPACE_TRUST_ENABLED).userValue ?? configurationService.inspect<boolean>(WORKSPACE_TRUST_ENABLED).defaultValue) ?? false;
}

export class WorkspaceTrustManagementService extends Disposable implements IWorkspaceTrustManagementService {

	_serviceBrand: undefined;

	private readonly storageKey = WORKSPACE_TRUST_STORAGE_KEY;

	private readonly _onDidChangeTrust = this._register(new Emitter<boolean>());
	readonly onDidChangeTrust = this._onDidChangeTrust.event;

	private readonly _onDidChangeTrustedFolders = this._register(new Emitter<void>());
	readonly onDidChangeTrustedFolders = this._onDidChangeTrustedFolders.event;

	private _trustStateInfo: IWorkspaceTrustInfo;

	private readonly _trustState: WorkspaceTrustState;
	private readonly _trustTransitionManager: WorkspaceTrustTransitionManager;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IStorageService private readonly storageService: IStorageService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService
	) {
		super();

		this._trustState = new WorkspaceTrustState(this.storageService);
		this._trustTransitionManager = this._register(new WorkspaceTrustTransitionManager());

		this._trustStateInfo = this.loadTrustInfo();
		this._trustState.isTrusted = this.calculateWorkspaceTrust();

		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(async () => await this.updateWorkspaceTrust()));
		this._register(this.workspaceService.onDidChangeWorkbenchState(async () => await this.updateWorkspaceTrust()));
		this._register(this.storageService.onDidChangeValue(async changeEvent => {
			/* This will only execute if storage was changed by a user action in a separate window */
			if (changeEvent.key === this.storageKey && JSON.stringify(this._trustStateInfo) !== JSON.stringify(this.loadTrustInfo())) {
				this._trustStateInfo = this.loadTrustInfo();
				this._onDidChangeTrustedFolders.fire();

				await this.updateWorkspaceTrust();
			}
		}));
	}

	private loadTrustInfo(): IWorkspaceTrustInfo {
		const infoAsString = this.storageService.get(this.storageKey, StorageScope.GLOBAL);

		let result: IWorkspaceTrustInfo | undefined;
		try {
			if (infoAsString) {
				result = JSON.parse(infoAsString);
			}
		} catch { }

		if (!result) {
			result = {
				uriTrustInfo: []
			};
		}

		if (!result.uriTrustInfo) {
			result.uriTrustInfo = [];
		}

		result.uriTrustInfo = result.uriTrustInfo.map(info => { return { uri: URI.revive(info.uri), trusted: info.trusted }; });
		result.uriTrustInfo = result.uriTrustInfo.filter(info => info.trusted);

		return result;
	}

	private async saveTrustInfo(): Promise<void> {
		this.storageService.store(this.storageKey, JSON.stringify(this._trustStateInfo), StorageScope.GLOBAL, StorageTarget.MACHINE);
		this._onDidChangeTrustedFolders.fire();

		await this.updateWorkspaceTrust();
	}

	private calculateWorkspaceTrust(): boolean {
		if (!isWorkspaceTrustEnabled(this.configurationService)) {
			return true;
		}

		if (this.environmentService.extensionTestsLocationURI) {
			return true; // trust running tests with vscode-test
		}

		if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
			// Use memento if present, otherwise default to restricted mode
			// Workspace may transition to trusted based on the opened editors
			return this._trustState.isTrusted ?? false;
		}

		const workspaceUris = this.getWorkspaceUris();
		const trusted = this.getUrisTrust(workspaceUris);

		return trusted;
	}

	private getUrisTrust(uris: URI[]): boolean {
		let state = true;
		for (const uri of uris) {
			const { trusted } = this.getUriTrustInfo(uri);

			if (!trusted) {
				state = trusted;
				return state;
			}
		}

		return state;
	}

	private getWorkspaceUris(): URI[] {
		const workspaceUris = this.workspaceService.getWorkspace().folders.map(f => f.uri);
		const workspaceConfiguration = this.workspaceService.getWorkspace().configuration;
		if (workspaceConfiguration && !isUntitledWorkspace(workspaceConfiguration, this.environmentService)) {
			workspaceUris.push(workspaceConfiguration);
		}

		return workspaceUris;
	}

	private async updateWorkspaceTrust(): Promise<void> {
		const trusted = this.calculateWorkspaceTrust();
		if (this.isWorkpaceTrusted() === trusted) { return; }

		// Update workspace trust
		this._trustState.isTrusted = trusted;

		// Run workspace trust transition participants
		await this._trustTransitionManager.participate(trusted);

		// Fire workspace trust change event
		this._onDidChangeTrust.fire(trusted);
	}

	get acceptsOutOfWorkspaceFiles(): boolean {
		return this._trustState.acceptsOutOfWorkspaceFiles;
	}

	set acceptsOutOfWorkspaceFiles(value: boolean) {
		this._trustState.acceptsOutOfWorkspaceFiles = value;
	}

	addWorkspaceTrustTransitionParticipant(participant: IWorkspaceTrustTransitionParticipant): IDisposable {
		return this._trustTransitionManager.addWorkspaceTrustTransitionParticipant(participant);
	}

	getUriTrustInfo(uri: URI): IWorkspaceTrustUriInfo {
		let resultState = false;
		let maxLength = -1;

		let resultUri = uri;

		for (const trustInfo of this._trustStateInfo.uriTrustInfo) {
			if (this.uriIdentityService.extUri.isEqualOrParent(uri, trustInfo.uri)) {
				const fsPath = trustInfo.uri.fsPath;
				if (fsPath.length > maxLength) {
					maxLength = fsPath.length;
					resultState = trustInfo.trusted;
					resultUri = trustInfo.uri;
				}
			}
		}

		return { trusted: resultState, uri: resultUri };
	}

	async setUrisTrust(uris: URI[], trusted: boolean): Promise<void> {
		let changed = false;

		for (const uri of uris) {
			if (trusted) {
				const foundItem = this._trustStateInfo.uriTrustInfo.find(trustInfo => this.uriIdentityService.extUri.isEqual(trustInfo.uri, uri));
				if (!foundItem) {
					this._trustStateInfo.uriTrustInfo.push({ uri, trusted: true });
					changed = true;
				}
			} else {
				const previousLength = this._trustStateInfo.uriTrustInfo.length;
				this._trustStateInfo.uriTrustInfo = this._trustStateInfo.uriTrustInfo.filter(trustInfo => !this.uriIdentityService.extUri.isEqual(trustInfo.uri, uri));
				if (previousLength !== this._trustStateInfo.uriTrustInfo.length) {
					changed = true;
				}
			}
		}

		if (changed) {
			await this.saveTrustInfo();
		}
	}

	canSetWorkspaceTrust(): boolean {
		// Empty workspace
		if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
			return true;
		}

		// Untrusted workspace
		if (!this.isWorkpaceTrusted()) {
			return true;
		}

		// Trusted workspace
		// Can only be trusted explicitly in the single folder scenario
		const workspaceIdentifier = toWorkspaceIdentifier(this.workspaceService.getWorkspace());
		if (!(isSingleFolderWorkspaceIdentifier(workspaceIdentifier) && workspaceIdentifier.uri.scheme === Schemas.file)) {
			return false;
		}

		// If the current folder isn't trusted directly, return false
		const trustInfo = this.getUriTrustInfo(workspaceIdentifier.uri);
		if (!trustInfo.trusted || !this.uriIdentityService.extUri.isEqual(workspaceIdentifier.uri, trustInfo.uri)) {
			return false;
		}

		// Check if the parent is also trusted
		if (this.canSetParentFolderTrust()) {
			const { parentPath } = splitName(workspaceIdentifier.uri.fsPath);
			const parentIsTrusted = this.getUriTrustInfo(URI.file(parentPath)).trusted;
			if (parentIsTrusted) {
				return false;
			}
		}

		return true;
	}

	canSetParentFolderTrust(): boolean {
		const workspaceIdentifier = toWorkspaceIdentifier(this.workspaceService.getWorkspace());
		return isSingleFolderWorkspaceIdentifier(workspaceIdentifier) && workspaceIdentifier.uri.scheme === Schemas.file;
	}

	isWorkpaceTrusted(): boolean {
		return this._trustState.isTrusted ?? false;
	}

	setParentFolderTrust(trusted: boolean): void {
		const workspaceIdentifier = toWorkspaceIdentifier(this.workspaceService.getWorkspace());
		if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier) && workspaceIdentifier.uri.scheme === Schemas.file) {
			const { parentPath } = splitName(workspaceIdentifier.uri.fsPath);

			this.setUrisTrust([URI.file(parentPath)], trusted);
		}
	}

	async setWorkspaceTrust(trusted: boolean): Promise<void> {
		// Empty workspace
		if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
			this._trustState.isTrusted = trusted;
			await this.updateWorkspaceTrust();

			return;
		}

		const workspaceFolders = this.getWorkspaceUris();
		await this.setUrisTrust(workspaceFolders, trusted);
	}

	getTrustedFolders(): URI[] {
		return this._trustStateInfo.uriTrustInfo.map(info => info.uri);
	}

	async setTrustedFolders(uris: URI[]): Promise<void> {
		this._trustStateInfo.uriTrustInfo = [];
		for (const uri of uris) {
			const cleanUri = this.uriIdentityService.extUri.removeTrailingPathSeparator(uri);
			let added = false;
			for (const addedUri of this._trustStateInfo.uriTrustInfo) {
				if (this.uriIdentityService.extUri.isEqual(addedUri.uri, cleanUri)) {
					added = true;
					break;
				}
			}

			if (added) {
				continue;
			}

			this._trustStateInfo.uriTrustInfo.push({
				trusted: true,
				uri: cleanUri
			});
		}

		await this.saveTrustInfo();
	}
}

export class WorkspaceTrustRequestService extends Disposable implements IWorkspaceTrustRequestService {
	_serviceBrand: undefined;

	private _trusted!: boolean;
	private _modalTrustRequestPromise?: Promise<boolean | undefined>;
	private _modalTrustRequestResolver?: (trusted: boolean | undefined) => void;
	private readonly _ctxWorkspaceTrustState: IContextKey<boolean>;

	private readonly _onDidInitiateWorkspaceTrustRequest = this._register(new Emitter<WorkspaceTrustRequestOptions | undefined>());
	readonly onDidInitiateWorkspaceTrustRequest = this._onDidInitiateWorkspaceTrustRequest.event;


	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IDialogService private readonly dialogService: IDialogService,
		@IStorageService private readonly storageService: IStorageService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustManagementService: IWorkspaceTrustManagementService
	) {
		super();

		this._register(this.workspaceTrustManagementService.onDidChangeTrust(trusted => this.trusted = trusted));

		this._ctxWorkspaceTrustState = WorkspaceTrustContext.IsTrusted.bindTo(contextKeyService);

		this.trusted = this.workspaceTrustManagementService.isWorkpaceTrusted();
	}

	private get trusted(): boolean {
		return this._trusted;
	}

	private set trusted(trusted: boolean) {
		this._trusted = trusted;
		this._ctxWorkspaceTrustState.set(trusted);
	}

	private resolveRequest(trusted?: boolean): void {
		if (this._modalTrustRequestResolver) {
			this._modalTrustRequestResolver(trusted ?? this.trusted);

			this._modalTrustRequestResolver = undefined;
			this._modalTrustRequestPromise = undefined;
		}
	}

	cancelRequest(): void {
		if (this._modalTrustRequestResolver) {
			this._modalTrustRequestResolver(undefined);

			this._modalTrustRequestResolver = undefined;
			this._modalTrustRequestPromise = undefined;
		}
	}

	async completeRequest(trusted?: boolean): Promise<void> {
		if (trusted === undefined || trusted === this.trusted) {
			this.resolveRequest(trusted);
			return;
		}

		// Update storage, transition workspace, and resolve the promise
		await this.workspaceTrustManagementService.setWorkspaceTrust(trusted);
		this.resolveRequest(trusted);
	}

	async requestOpenUris(uris: URI[]): Promise<WorkspaceTrustUriResponse> {
		// If workspace is untrusted, there is no conflict
		if (!this.trusted) {
			return WorkspaceTrustUriResponse.Open;
		}

		const allTrusted = uris.map(uri => {
			return this.workspaceTrustManagementService.getUriTrustInfo(uri).trusted;
		}).every(trusted => trusted);

		// If all uris are trusted, there is no conflict
		if (allTrusted) {
			return WorkspaceTrustUriResponse.Open;
		}

		// If we already asked the user, don't need to ask again
		if (this.workspaceTrustManagementService.acceptsOutOfWorkspaceFiles) {
			return WorkspaceTrustUriResponse.Open;
		}

		// If user applies choice to all workspaces, don't need to ask again
		const rememberedChoiceForAllWorkspaces = this.storageService.get(WORKSPACE_TRUST_NON_WORKSPACE_FILES_DECISION_KEY, StorageScope.GLOBAL, undefined) as WorkspaceTrustUriResponse | undefined;
		if (rememberedChoiceForAllWorkspaces !== undefined) {
			return rememberedChoiceForAllWorkspaces;
		}

		const markdownDetails = [
			this.workspaceService.getWorkbenchState() !== WorkbenchState.EMPTY ?
				localize('openLooseFileWorkspaceDetails', "You are trying to open untrusted files in a workspace which is trusted.") :
				localize('openLooseFileWindowDetails', "You are trying to open untrusted files in a window which is trusted."),
			localize('openLooseFileLearnMore', "If you don't trust the authors of these files, we recommend to open them in a new Restricted Mode window as the files may be malicious. See [our docs](https://aka.ms/vscode-workspace-trust) to learn more.")
		];

		const result = await this.dialogService.show(Severity.Info, localize('openLooseFileMesssage', "Do you trust the authors of these files?"), [localize('open', "Open"), localize('newWindow', "Open in New Restricted Mode Window"), localize('cancel', "Cancel")], {
			cancelId: 2,
			checkbox: {
				label: localize('openLooseFileWorkspaceCheckbox', "Remember my decision for all workspaces"),
				checked: false
			},
			custom: {
				icon: Codicon.shield,
				markdownDetails: markdownDetails.map(md => { return { markdown: new MarkdownString(md) }; })
			}
		});

		const saveResponse = (response: WorkspaceTrustUriResponse) => {
			this.storageService.store(WORKSPACE_TRUST_NON_WORKSPACE_FILES_DECISION_KEY, response, StorageScope.GLOBAL, StorageTarget.MACHINE);
			return response;
		};

		switch (result.choice) {
			case 0:
				this.workspaceTrustManagementService.acceptsOutOfWorkspaceFiles = true;
				return saveResponse(WorkspaceTrustUriResponse.Open);
			case 1:
				return saveResponse(WorkspaceTrustUriResponse.OpenInNewWindow);
			default:
				return WorkspaceTrustUriResponse.Cancel;
		}
	}

	async requestWorkspaceTrust(options?: WorkspaceTrustRequestOptions): Promise<boolean | undefined> {
		// Trusted workspace
		if (this.trusted) {
			return this.trusted;
		}

		// Modal request
		if (!this._modalTrustRequestPromise) {
			// Create promise
			this._modalTrustRequestPromise = new Promise(resolve => {
				this._modalTrustRequestResolver = resolve;
			});
		} else {
			// Return existing promise
			return this._modalTrustRequestPromise;
		}

		this._onDidInitiateWorkspaceTrustRequest.fire(options);
		return this._modalTrustRequestPromise;
	}
}

class WorkspaceTrustTransitionManager extends Disposable {

	private readonly participants = new LinkedList<IWorkspaceTrustTransitionParticipant>();

	addWorkspaceTrustTransitionParticipant(participant: IWorkspaceTrustTransitionParticipant): IDisposable {
		const remove = this.participants.push(participant);
		return toDisposable(() => remove());
	}

	async participate(trusted: boolean): Promise<void> {
		for (const participant of this.participants) {
			await participant.participate(trusted);
		}
	}

	override dispose(): void {
		this.participants.clear();
	}
}

class WorkspaceTrustState {
	private readonly _memento: Memento;
	private readonly _mementoObject: MementoObject;

	private readonly _acceptsOutOfWorkspaceFilesKey = 'acceptsOutOfWorkspaceFiles';
	private readonly _isTrustedKey = 'isTrusted';

	constructor(storageService: IStorageService) {
		this._memento = new Memento('workspaceTrust', storageService);
		this._mementoObject = this._memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	get acceptsOutOfWorkspaceFiles(): boolean {
		return this._mementoObject[this._acceptsOutOfWorkspaceFilesKey] ?? false;
	}

	set acceptsOutOfWorkspaceFiles(value: boolean) {
		this._mementoObject[this._acceptsOutOfWorkspaceFilesKey] = value;
		this._memento.saveMemento();
	}

	get isTrusted(): boolean | undefined {
		return this._mementoObject[this._isTrustedKey];
	}

	set isTrusted(value: boolean | undefined) {
		this._mementoObject[this._isTrustedKey] = value;
		if (!value) {
			this._mementoObject[this._acceptsOutOfWorkspaceFilesKey] = value;
		}

		this._memento.saveMemento();
	}
}

registerSingleton(IWorkspaceTrustRequestService, WorkspaceTrustRequestService);
