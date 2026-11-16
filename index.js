(() => {
    'use strict';

    const EXTENSION_NAME = 'Range Hide';
    const ROOT_ID = 'range-hide-extension';
    let refreshTimer = null;

    function getContext() {
        return window.SillyTavern?.getContext?.();
    }

    function getChat() {
        return getContext()?.chat ?? [];
    }

    function getHiddenCount(chat) {
        return chat.filter(message => message?.is_system === true).length;
    }

    function setStatus(message, type = '') {
        const status = document.querySelector(`#${ROOT_ID} .range-hide-status`);
        if (!status) return;
        status.textContent = message;
        status.dataset.type = type;
    }

    function refreshInfo() {
        const root = document.getElementById(ROOT_ID);
        if (!root) return;

        const chat = getChat();
        const total = chat.length;
        const hidden = getHiddenCount(chat);
        const info = root.querySelector('.range-hide-info');
        const start = root.querySelector('#range-hide-start');
        const end = root.querySelector('#range-hide-end');

        info.textContent = total
            ? `Сообщений в чате: ${total} · скрыто от ИИ: ${hidden}. Индексы начинаются с 0.`
            : 'Открой чат, чтобы управлять скрытием сообщений.';

        for (const input of [start, end]) {
            input.max = String(Math.max(0, total - 1));
            input.disabled = total === 0;
        }

        root.querySelectorAll('button[data-action]').forEach(button => {
            button.disabled = total === 0;
        });
    }

    async function applyRange(action) {
        const chat = getChat();
        if (!chat.length) {
            setStatus('Сначала открой чат.', 'error');
            return;
        }

        const root = document.getElementById(ROOT_ID);
        const startInput = root.querySelector('#range-hide-start');
        const endInput = root.querySelector('#range-hide-end');

        const startRaw = startInput.value.trim();
        const endRaw = endInput.value.trim();

        if (startRaw === '' || endRaw === '') {
            setStatus('Укажи начальный и конечный номер сообщения.', 'error');
            return;
        }

        const start = Number(startRaw);
        const end = Number(endRaw);

        if (!Number.isInteger(start) || !Number.isInteger(end) ||
            start < 0 || end < 0 || start > end ||
            end >= chat.length) {
            setStatus(`Некорректный диапазон. Допустимо: 0–${chat.length - 1}.`, 'error');
            return;
        }

        const command = action === 'hide' ? '/hide' : '/unhide';
        const label = action === 'hide' ? 'Скрываю' : 'Возвращаю в контекст';

        try {
            const context = getContext();
            if (typeof context?.executeSlashCommands !== 'function') {
                throw new Error('В этой версии SillyTavern недоступен executeSlashCommands.');
            }

            setStatus(`${label} сообщения ${start}–${end}…`);
            await context.executeSlashCommands(`${command} ${start}-${end}`);

            refreshInfo();
            setStatus(
                action === 'hide'
                    ? `Готово: сообщения ${start}–${end} исключены из контекста ИИ.`
                    : `Готово: сообщения ${start}–${end} снова включены в контекст ИИ.`,
                'success'
            );
        } catch (error) {
            console.error(`[${EXTENSION_NAME}]`, error);
            setStatus(`Не удалось выполнить команду: ${error.message || error}`, 'error');
        }
    }

    function createPanel() {
        if (document.getElementById(ROOT_ID)) return;

        const panel = document.createElement('div');
        panel.id = ROOT_ID;
        panel.className = 'range-hide-settings';
        panel.innerHTML = `
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Range Hide — скрытие диапазона</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <p class="range-hide-description">
                        Исключает выбранные сообщения из контекста модели штатным механизмом SillyTavern.
                        Сами сообщения остаются в истории чата.
                    </p>

                    <div class="range-hide-fields">
                        <label>
                            <span>С какого сообщения</span>
                            <input id="range-hide-start" type="number" min="0" step="1" inputmode="numeric" placeholder="Например, 20">
                        </label>
                        <label>
                            <span>По какое сообщение</span>
                            <input id="range-hide-end" type="number" min="0" step="1" inputmode="numeric" placeholder="Например, 45">
                        </label>
                    </div>

                    <div class="range-hide-buttons">
                        <button class="menu_button" type="button" data-action="hide">
                            <i class="fa-solid fa-eye-slash"></i> Скрыть от ИИ
                        </button>
                        <button class="menu_button" type="button" data-action="unhide">
                            <i class="fa-solid fa-eye"></i> Вернуть в контекст
                        </button>
                    </div>

                    <div class="range-hide-info"></div>
                    <div class="range-hide-status" role="status" aria-live="polite"></div>
                    <div class="range-hide-note">
                        Нумерация — как в SillyTavern: с нуля. Диапазон включительный.
                        Например, 20–45 затронет оба крайних сообщения.
                    </div>
                </div>
            </div>
        `;

        panel.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', () => applyRange(button.dataset.action));
        });

        const target = document.querySelector('#extensions_settings2')
            || document.querySelector('#extensions_settings');

        if (target) {
            target.append(panel);
            refreshInfo();
        } else {
            // Settings containers may appear slightly later on slower mobile devices.
            refreshTimer = window.setTimeout(createPanel, 500);
        }
    }

    function init() {
        createPanel();

        const context = getContext();
        if (context?.eventSource && context?.event_types?.CHAT_CHANGED) {
            context.eventSource.on(context.event_types.CHAT_CHANGED, () => {
                refreshInfo();
                setStatus('');
            });
        }

        if (context?.eventSource && context?.event_types?.APP_READY) {
            context.eventSource.on(context.event_types.APP_READY, refreshInfo);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
