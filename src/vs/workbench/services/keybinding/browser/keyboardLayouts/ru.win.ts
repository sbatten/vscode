/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyboardLayoutProvider, KeyboardLayoutInfo } from 'vs/workbench/services/keybinding/browser/keyboardLayoutProvider';

KeyboardLayoutProvider.INSTANCE.registerKeyboardLayout((new KeyboardLayoutInfo(
	{ name: '00000419', id: '', text: 'Russian' },
	[],
	{
		Sleep: [],
		WakeUp: [],
		KeyA: ['ф', 'Ф', '', '', 0, 'VK_A'],
		KeyB: ['и', 'И', '', '', 0, 'VK_B'],
		KeyC: ['с', 'С', '', '', 0, 'VK_C'],
		KeyD: ['в', 'В', '', '', 0, 'VK_D'],
		KeyE: ['у', 'У', '', '', 0, 'VK_E'],
		KeyF: ['а', 'А', '', '', 0, 'VK_F'],
		KeyG: ['п', 'П', '', '', 0, 'VK_G'],
		KeyH: ['р', 'Р', '', '', 0, 'VK_H'],
		KeyI: ['ш', 'Ш', '', '', 0, 'VK_I'],
		KeyJ: ['о', 'О', '', '', 0, 'VK_J'],
		KeyK: ['л', 'Л', '', '', 0, 'VK_K'],
		KeyL: ['д', 'Д', '', '', 0, 'VK_L'],
		KeyM: ['ь', 'Ь', '', '', 0, 'VK_M'],
		KeyN: ['т', 'Т', '', '', 0, 'VK_N'],
		KeyO: ['щ', 'Щ', '', '', 0, 'VK_O'],
		KeyP: ['з', 'З', '', '', 0, 'VK_P'],
		KeyQ: ['й', 'Й', '', '', 0, 'VK_Q'],
		KeyR: ['к', 'К', '', '', 0, 'VK_R'],
		KeyS: ['ы', 'Ы', '', '', 0, 'VK_S'],
		KeyT: ['е', 'Е', '', '', 0, 'VK_T'],
		KeyU: ['г', 'Г', '', '', 0, 'VK_U'],
		KeyV: ['м', 'М', '', '', 0, 'VK_V'],
		KeyW: ['ц', 'Ц', '', '', 0, 'VK_W'],
		KeyX: ['ч', 'Ч', '', '', 0, 'VK_X'],
		KeyY: ['н', 'Н', '', '', 0, 'VK_Y'],
		KeyZ: ['я', 'Я', '', '', 0, 'VK_Z'],
		Digit1: ['1', '!', '', '', 0, 'VK_1'],
		Digit2: ['2', '"', '', '', 0, 'VK_2'],
		Digit3: ['3', '№', '', '', 0, 'VK_3'],
		Digit4: ['4', ';', '', '', 0, 'VK_4'],
		Digit5: ['5', '%', '', '', 0, 'VK_5'],
		Digit6: ['6', ':', '', '', 0, 'VK_6'],
		Digit7: ['7', '?', '', '', 0, 'VK_7'],
		Digit8: ['8', '*', '₽', '', 0, 'VK_8'],
		Digit9: ['9', '(', '', '', 0, 'VK_9'],
		Digit0: ['0', ')', '', '', 0, 'VK_0'],
		Enter: [],
		Escape: [],
		Backspace: [],
		Tab: [],
		Space: [' ', ' ', '', '', 0, 'VK_SPACE'],
		Minus: ['-', '_', '', '', 0, 'VK_OEM_MINUS'],
		Equal: ['=', '+', '', '', 0, 'VK_OEM_PLUS'],
		BracketLeft: ['х', 'Х', '', '', 0, 'VK_OEM_4'],
		BracketRight: ['ъ', 'Ъ', '', '', 0, 'VK_OEM_6'],
		Backslash: ['\\', '/', '', '', 0, 'VK_OEM_5'],
		Semicolon: ['ж', 'Ж', '', '', 0, 'VK_OEM_1'],
		Quote: ['э', 'Э', '', '', 0, 'VK_OEM_7'],
		Backquote: ['ё', 'Ё', '', '', 0, 'VK_OEM_3'],
		Comma: ['б', 'Б', '', '', 0, 'VK_OEM_COMMA'],
		Period: ['ю', 'Ю', '', '', 0, 'VK_OEM_PERIOD'],
		Slash: ['.', ',', '', '', 0, 'VK_OEM_2'],
		CapsLock: [],
		F1: [],
		F2: [],
		F3: [],
		F4: [],
		F5: [],
		F6: [],
		F7: [],
		F8: [],
		F9: [],
		F10: [],
		F11: [],
		F12: [],
		PrintScreen: [],
		ScrollLock: [],
		Pause: [],
		Insert: [],
		Home: [],
		PageUp: [],
		Delete: [],
		End: [],
		PageDown: [],
		ArrowRight: [],
		ArrowLeft: [],
		ArrowDown: [],
		ArrowUp: [],
		NumLock: [],
		NumpadDivide: ['/', '/', '', '', 0, 'VK_DIVIDE'],
		NumpadMultiply: ['*', '*', '', '', 0, 'VK_MULTIPLY'],
		NumpadSubtract: ['-', '-', '', '', 0, 'VK_SUBTRACT'],
		NumpadAdd: ['+', '+', '', '', 0, 'VK_ADD'],
		NumpadEnter: [],
		Numpad1: [],
		Numpad2: [],
		Numpad3: [],
		Numpad4: [],
		Numpad5: [],
		Numpad6: [],
		Numpad7: [],
		Numpad8: [],
		Numpad9: [],
		Numpad0: [],
		NumpadDecimal: [],
		IntlBackslash: ['\\', '/', '', '', 0, 'VK_OEM_102'],
		ContextMenu: [],
		Power: [],
		NumpadEqual: [],
		F13: [],
		F14: [],
		F15: [],
		F16: [],
		F17: [],
		F18: [],
		F19: [],
		F20: [],
		F21: [],
		F22: [],
		F23: [],
		F24: [],
		Help: [],
		Undo: [],
		Cut: [],
		Copy: [],
		Paste: [],
		AudioVolumeMute: [],
		AudioVolumeUp: [],
		AudioVolumeDown: [],
		NumpadComma: [],
		IntlRo: [],
		KanaMode: [],
		IntlYen: [],
		Convert: [],
		NonConvert: [],
		Lang1: [],
		Lang2: [],
		Lang3: [],
		Lang4: [],
		ControlLeft: [],
		ShiftLeft: [],
		AltLeft: [],
		MetaLeft: [],
		ControlRight: [],
		ShiftRight: [],
		AltRight: [],
		MetaRight: [],
		MediaTrackNext: [],
		MediaTrackPrevious: [],
		MediaStop: [],
		Eject: [],
		MediaPlayPause: [],
		MediaSelect: [],
		LaunchMail: [],
		LaunchApp2: [],
		LaunchApp1: [],
		BrowserSearch: [],
		BrowserHome: [],
		BrowserBack: [],
		BrowserForward: [],
		BrowserStop: [],
		BrowserRefresh: [],
		BrowserFavorites: []
	}
)));