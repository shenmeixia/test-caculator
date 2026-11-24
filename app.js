(function () {
      const STORAGE_HISTORY_KEY = 'int_calc_history_v1';
      const STORAGE_THEME_KEY = 'int_calc_theme_v1';
      const STORAGE_DIVMODE_KEY = 'int_calc_divmode_v1';
      const MAX_DIGITS = 30;
      const DECIMAL_PRECISION = 10;

      const OP_SYMBOLS = {
        '+': '+',
        '-': '−',
        '*': '×',
        '/': '÷'
      };

      const state = {
        currentInput: '0',       // String representation of integer (optional leading '-')
        previousValue: null,     // BigInt or null
        operator: null,          // '+', '-', '*', '/' or null
        waitingForOperand: false,
        lastOperator: null,      // For repeated '=' presses
        lastOperand: null,       // BigInt for repeated '=' presses
        expressionText: '',
        subText: '',
        decimalDisplay: null,    // String if last result was non-integer decimal in decimal mode
        error: null,
        divisionMode: 'remainder', // 'remainder' | 'decimal'
        history: []
      };

      // DOM elements
      const mainDisplay = document.getElementById('mainDisplay');
      const expressionDisplay = document.getElementById('expressionDisplay');
      const subDisplay = document.getElementById('subDisplay');
      const clearBtnLabel = document.getElementById('clearBtnLabel');
      const historyList = document.getElementById('historyList');
      const historyEmpty = document.getElementById('historyEmpty');
      const historyCount = document.getElementById('historyCount');
      const clearHistoryBtn = document.getElementById('clearHistoryBtn');
      const modeRemainderBtn = document.getElementById('modeRemainderBtn');
      const modeDecimalBtn = document.getElementById('modeDecimalBtn');
      const themeToggleBtn = document.getElementById('themeToggleBtn');
      const iconSun = document.getElementById('iconSun');
      const iconMoon = document.getElementById('iconMoon');
      const copyBtn = document.getElementById('copyBtn');
      const toastEl = document.getElementById('toast');
      const opButtons = document.querySelectorAll('.op-btn');

      let toastTimer = null;

      function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.remove('opacity-0');
        toastEl.classList.add('opacity-100');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          toastEl.classList.remove('opacity-100');
          toastEl.classList.add('opacity-0');
        }, 1600);
      }

      // Format BigInt or integer string with thousand separators
      function formatIntegerStr(val) {
        const str = typeof val === 'bigint' ? val.toString() : String(val);
        if (!/^-?\d+$/.test(str)) return str;
        const isNeg = str.startsWith('-');
        const digits = isNeg ? str.slice(1) : str;
        const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return isNeg ? '−' + formatted : formatted;
      }

      function formatDecimalStr(decStr) {
        const isNeg = decStr.startsWith('-');
        const clean = isNeg ? decStr.slice(1) : decStr;
        const parts = clean.split('.');
        const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const result = parts.length > 1 ? intPart + '.' + parts[1] : intPart;
        return isNeg ? '−' + result : result;
      }

      // Exact BigInt division to decimal string (up to DECIMAL_PRECISION digits)
      function bigIntDivideDecimal(a, b, maxDecimals) {
        const negative = (a < 0n) !== (b < 0n);
        const absA = a < 0n ? -a : a;
        const absB = b < 0n ? -b : b;
        const quotient = absA / absB;
        let remainder = absA % absB;

        if (remainder === 0n) {
          return {
            isExact: true,
            value: (negative && quotient !== 0n ? '-' : '') + quotient.toString()
          };
        }

        let frac = '';
        for (let i = 0; i < maxDecimals && remainder !== 0n; i++) {
          remainder *= 10n;
          const digit = remainder / absB;
          remainder = remainder % absB;
          frac += digit.toString();
        }
        const isExact = remainder === 0n;
        // Trim trailing zeros
        frac = frac.replace(/0+$/, '');
        const prefix = negative ? '-' : '';
        return {
          isExact,
          value: frac ? `${prefix}${quotient.toString()}.${frac}` : `${prefix}${quotient.toString()}`
        };
      }

      function compute(a, op, b) {
        switch (op) {
          case '+':
            return { quotient: a + b, remainder: 0n, decimal: null, exact: true };
          case '-':
            return { quotient: a - b, remainder: 0n, decimal: null, exact: true };
          case '*':
            return { quotient: a * b, remainder: 0n, decimal: null, exact: true };
          case '/': {
            if (b === 0n) {
              return { error: '不能除以 0' };
            }
            const quotient = a / b;
            const remainder = a % b;
            const dec = bigIntDivideDecimal(a, b, DECIMAL_PRECISION);
            return {
              quotient,
              remainder,
              decimal: dec.value,
              exact: dec.isExact
            };
          }
          default:
            return { quotient: b, remainder: 0n, decimal: null, exact: true };
        }
      }

      function safeParseBigInt(str) {
        try {
          return BigInt(str);
        } catch (e) {
          return 0n;
        }
      }

      function loadStorage() {
        try {
          const savedHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
          if (savedHistory) {
            const parsed = JSON.parse(savedHistory);
            if (Array.isArray(parsed)) {
              state.history = parsed.slice(0, 50);
            }
          }
        } catch (e) {
          // Ignore storage errors in restricted environments
        }

        try {
          const savedMode = localStorage.getItem(STORAGE_DIVMODE_KEY);
          if (savedMode === 'remainder' || savedMode === 'decimal') {
            state.divisionMode = savedMode;
          }
        } catch (e) {}

        try {
          const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
          if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else if (savedTheme === 'light') {
            document.documentElement.classList.remove('dark');
          } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          }
        } catch (e) {}
      }

      function saveHistory() {
        try {
          localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(state.history.slice(0, 50)));
        } catch (e) {}
      }

      function updateThemeIcons() {
        const isDark = document.documentElement.classList.contains('dark');
        iconSun.classList.toggle('hidden', !isDark);
        iconMoon.classList.toggle('hidden', isDark);
      }

      function updateDivisionModeUI() {
        const isRem = state.divisionMode === 'remainder';
        const activeClasses = ['bg-white', 'dark:bg-slate-700', 'text-indigo-600', 'dark:text-indigo-300', 'shadow-sm'];
        const inactiveClasses = ['text-slate-600', 'dark:text-slate-400', 'hover:text-slate-900', 'dark:hover:text-slate-200'];

        if (isRem) {
          modeRemainderBtn.classList.add(...activeClasses);
          modeRemainderBtn.classList.remove(...inactiveClasses);
          modeDecimalBtn.classList.remove(...activeClasses);
          modeDecimalBtn.classList.add(...inactiveClasses);
        } else {
          modeDecimalBtn.classList.add(...activeClasses);
          modeDecimalBtn.classList.remove(...inactiveClasses);
          modeRemainderBtn.classList.remove(...activeClasses);
          modeRemainderBtn.classList.add(...inactiveClasses);
        }
      }

      function updateDisplayFontSize(text) {
        mainDisplay.classList.remove('text-4xl', 'sm:text-5xl', 'text-3xl', 'sm:text-4xl', 'text-2xl', 'sm:text-3xl', 'text-xl', 'sm:text-2xl');
        const len = text.length;
        if (len <= 12) {
          mainDisplay.classList.add('text-4xl', 'sm:text-5xl');
        } else if (len <= 18) {
          mainDisplay.classList.add('text-3xl', 'sm:text-4xl');
        } else if (len <= 26) {
          mainDisplay.classList.add('text-2xl', 'sm:text-3xl');
        } else {
          mainDisplay.classList.add('text-xl', 'sm:text-2xl');
        }
      }

      function renderDisplay() {
        if (state.error) {
          mainDisplay.textContent = state.error;
          mainDisplay.classList.add('text-rose-600', 'dark:text-rose-400');
          mainDisplay.classList.remove('text-slate-900', 'dark:text-white');
          updateDisplayFontSize(state.error);
          expressionDisplay.textContent = state.expressionText || '\u00A0';
          subDisplay.textContent = '按任意数字或 AC 重新开始';
        } else {
          mainDisplay.classList.remove('text-rose-600', 'dark:text-rose-400');
          mainDisplay.classList.add('text-slate-900', 'dark:text-white');

          let displayText;
          if (state.decimalDisplay !== null) {
            displayText = formatDecimalStr(state.decimalDisplay);
          } else {
            displayText = formatIntegerStr(state.currentInput);
          }

          mainDisplay.textContent = displayText;
          updateDisplayFontSize(displayText);
          expressionDisplay.textContent = state.expressionText || '\u00A0';
          subDisplay.textContent = state.subText || '';
        }

        // AC vs C label
        const isFresh = state.currentInput === '0' && state.previousValue === null && !state.operator && !state.error;
        clearBtnLabel.textContent = isFresh ? 'AC' : 'C';

        // Highlight active operator when waiting for second operand
        opButtons.forEach((btn) => {
          const isActive = state.operator === btn.dataset.op && state.waitingForOperand && !state.error;
          if (isActive) {
            btn.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-600', 'text-white', 'dark:bg-indigo-500', 'dark:text-white');
            btn.classList.remove('bg-indigo-50', 'dark:bg-indigo-950/60', 'text-indigo-600', 'dark:text-indigo-300');
          } else {
            btn.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-600', 'text-white', 'dark:bg-indigo-500', 'dark:text-white');
            btn.classList.add('bg-indigo-50', 'dark:bg-indigo-950/60', 'text-indigo-600', 'dark:text-indigo-300');
          }
        });
      }

      function renderHistory() {
        historyCount.textContent = String(state.history.length);
        clearHistoryBtn.disabled = state.history.length === 0;

        if (state.history.length === 0) {
          historyList.innerHTML = '';
          historyList.classList.add('hidden');
          historyEmpty.classList.remove('hidden');
          return;
        }

        historyEmpty.classList.add('hidden');
        historyList.classList.remove('hidden');

        historyList.innerHTML = state.history.map((item, idx) => {
          return `
            <button type="button" data-history-index="${idx}"
              class="w-full text-right p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-slate-200/70 dark:border-slate-700/60 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors group">
              <div class="text-xs text-slate-500 dark:text-slate-400 tabular-nums break-all">${escapeHtml(item.expr)}</div>
              <div class="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 tabular-nums break-all mt-0.5">
                = ${escapeHtml(item.displayResult)}
              </div>
              ${item.note ? `<div class="text-[11px] text-indigo-600 dark:text-indigo-400 tabular-nums mt-0.5">${escapeHtml(item.note)}</div>` : ''}
            </button>
          `;
        }).join('');
      }

      function escapeHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function addHistory(expr, displayResult, rawIntValue, note) {
        state.history.unshift({
          expr,
          displayResult,
          rawIntValue: rawIntValue.toString(),
          note: note || ''
        });
        if (state.history.length > 50) {
          state.history.pop();
        }
        saveHistory();
        renderHistory();
      }

      function resetAll() {
        state.currentInput = '0';
        state.previousValue = null;
        state.operator = null;
        state.waitingForOperand = false;
        state.lastOperator = null;
        state.lastOperand = null;
        state.expressionText = '';
        state.subText = '';
        state.decimalDisplay = null;
        state.error = null;
        renderDisplay();
      }

      function handleDigit(digit) {
        if (state.error) {
          resetAll();
        }

        state.decimalDisplay = null;
        state.subText = '';

        if (state.waitingForOperand) {
          state.currentInput = digit === '00' ? '0' : digit;
          state.waitingForOperand = false;
          // If starting a fresh calculation after '=', clear old expression
          if (state.operator === null) {
            state.expressionText = '';
            state.previousValue = null;
          }
          renderDisplay();
          return;
        }

        const unsignedLen = state.currentInput.replace('-', '').length;
        if (unsignedLen >= MAX_DIGITS) {
          showToast(`最多支持输入 ${MAX_DIGITS} 位整数`);
          return;
        }

        if (state.currentInput === '0') {
          state.currentInput = digit === '00' ? '0' : digit;
        } else if (state.currentInput === '-0') {
          state.currentInput = digit === '00' ? '0' : '-' + digit;
        } else {
          const next = state.currentInput + digit;
          if (next.replace('-', '').length > MAX_DIGITS) {
            const remaining = MAX_DIGITS - unsignedLen;
            state.currentInput += digit.slice(0, remaining);
          } else {
            state.currentInput = next;
          }
        }
        renderDisplay();
      }

      function handleBackspace() {
        if (state.error) {
          resetAll();
          return;
        }
        if (state.waitingForOperand || state.decimalDisplay !== null) {
          state.currentInput = '0';
          state.decimalDisplay = null;
          state.subText = '';
          state.waitingForOperand = false;
          renderDisplay();
          return;
        }

        if (state.currentInput.length <= 1 || (state.currentInput.length === 2 && state.currentInput.startsWith('-'))) {
          state.currentInput = '0';
        } else {
          state.currentInput = state.currentInput.slice(0, -1);
        }
        renderDisplay();
      }

      function handleToggleSign() {
        if (state.error) {
          resetAll();
          return;
        }
        state.decimalDisplay = null;
        state.subText = '';

        if (state.currentInput === '0') {
          renderDisplay();
          return;
        }

        if (state.currentInput.startsWith('-')) {
          state.currentInput = state.currentInput.slice(1);
        } else {
          state.currentInput = '-' + state.currentInput;
        }

        // If user just finished an '=' calculation and flips sign, update previousValue too
        if (state.waitingForOperand && state.operator === null) {
          state.previousValue = safeParseBigInt(state.currentInput);
        }
        renderDisplay();
      }

      function formatOperandForExpr(val) {
        const formatted = formatIntegerStr(val);
        return val < 0n ? `(${formatted})` : formatted;
      }

      function handleOperator(nextOp) {
        if (state.error) {
          resetAll();
        }

        const inputVal = safeParseBigInt(state.currentInput);
        state.decimalDisplay = null;

        // Allow switching operator before typing next operand
        if (state.operator && state.waitingForOperand) {
          state.operator = nextOp;
          state.expressionText = `${formatIntegerStr(state.previousValue)} ${OP_SYMBOLS[nextOp]}`;
          state.subText = '';
          renderDisplay();
          return;
        }

        if (state.previousValue === null) {
          state.previousValue = inputVal;
        } else if (state.operator) {
          const res = compute(state.previousValue, state.operator, inputVal);
          if (res.error) {
            state.expressionText = `${formatIntegerStr(state.previousValue)} ${OP_SYMBOLS[state.operator]} ${formatOperandForExpr(inputVal)} =`;
            state.error = res.error;
            renderDisplay();
            return;
          }
          const expr = `${formatIntegerStr(state.previousValue)} ${OP_SYMBOLS[state.operator]} ${formatOperandForExpr(inputVal)}`;
          const note = (state.operator === '/' && res.remainder !== 0n)
            ? `商 ${formatIntegerStr(res.quotient)}，余 ${formatIntegerStr(res.remainder)}（链式运算取整商）`
            : '';
          addHistory(expr, formatIntegerStr(res.quotient), res.quotient, note);

          state.previousValue = res.quotient;
          state.currentInput = res.quotient.toString();
          state.subText = note;
        }

        state.operator = nextOp;
        state.waitingForOperand = true;
        state.expressionText = `${formatIntegerStr(state.previousValue)} ${OP_SYMBOLS[nextOp]}`;
        renderDisplay();
      }

      function handleEquals() {
        if (state.error) {
          resetAll();
          return;
        }

        let left, op, right;

        if (state.operator !== null && state.previousValue !== null) {
          left = state.previousValue;
          op = state.operator;
          right = safeParseBigInt(state.currentInput);
          state.lastOperator = op;
          state.lastOperand = right;
        } else if (state.lastOperator !== null && state.lastOperand !== null) {
          left = safeParseBigInt(state.currentInput);
          op = state.lastOperator;
          right = state.lastOperand;
        } else {
          return;
        }

        const res = compute(left, op, right);
        const expr = `${formatIntegerStr(left)} ${OP_SYMBOLS[op]} ${formatOperandForExpr(right)}`;
        state.expressionText = `${expr} =`;

        if (res.error) {
          state.error = res.error;
          state.previousValue = null;
          state.operator = null;
          renderDisplay();
          return;
        }

        let historyDisplay = formatIntegerStr(res.quotient);
        let note = '';

        if (op === '/' && res.remainder !== 0n) {
          if (state.divisionMode === 'remainder') {
            state.decimalDisplay = null;
            state.currentInput = res.quotient.toString();
            const remStr = formatIntegerStr(res.remainder);
            state.subText = `余数：${remStr}（精确小数 ${res.exact ? '=' : '≈'} ${formatDecimalStr(res.decimal)}）`;
            historyDisplay = `${formatIntegerStr(res.quotient)} ... 余 ${remStr}`;
            note = `小数 ${res.exact ? '=' : '≈'} ${formatDecimalStr(res.decimal)}`;
          } else {
            state.decimalDisplay = res.decimal;
            state.currentInput = res.quotient.toString();
            const remStr = formatIntegerStr(res.remainder);
            state.subText = `${res.exact ? '精确结果' : `保留 ${DECIMAL_PRECISION} 位小数`} · 整除商 ${formatIntegerStr(res.quotient)}，余 ${remStr}`;
            historyDisplay = (res.exact ? '' : '≈ ') + formatDecimalStr(res.decimal);
            note = `整除商 ${formatIntegerStr(res.quotient)}，余 ${remStr}`;
          }
        } else {
          state.decimalDisplay = null;
          state.currentInput = res.quotient.toString();
          state.subText = op === '/' ? '整除，无余数' : '';
        }

        addHistory(expr, historyDisplay, res.quotient, note);

        state.previousValue = null;
        state.operator = null;
        state.waitingForOperand = true;
        renderDisplay();
      }

      function handleCopy() {
        if (state.error) return;
        const textToCopy = state.decimalDisplay !== null ? state.decimalDisplay : state.currentInput;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            showToast(`已复制：${textToCopy}`);
          }).catch(() => fallbackCopy(textToCopy));
        } else {
          fallbackCopy(textToCopy);
        }
      }

      function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          showToast(`已复制：${text}`);
        } catch (e) {
          showToast('复制失败');
        }
        document.body.removeChild(ta);
      }

      function flashButton(key) {
        const btn = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
        if (!btn) return;
        btn.classList.add('is-pressed');
        setTimeout(() => btn.classList.remove('is-pressed'), 110);
      }

      // Event Listeners: Keypad
      document.querySelectorAll('[data-digit]').forEach((btn) => {
        btn.addEventListener('click', () => handleDigit(btn.dataset.digit));
      });

      opButtons.forEach((btn) => {
        btn.addEventListener('click', () => handleOperator(btn.dataset.op));
      });

      document.querySelector('[data-action="equals"]').addEventListener('click', handleEquals);
      document.querySelector('[data-action="clear"]').addEventListener('click', resetAll);
      document.querySelector('[data-action="backspace"]').addEventListener('click', handleBackspace);
      document.querySelector('[data-action="toggle-sign"]').addEventListener('click', handleToggleSign);

      // Copy button
      copyBtn.addEventListener('click', handleCopy);

      // Division mode toggle
      modeRemainderBtn.addEventListener('click', () => {
        state.divisionMode = 'remainder';
        try { localStorage.setItem(STORAGE_DIVMODE_KEY, 'remainder'); } catch (e) {}
        updateDivisionModeUI();
        showToast('已切换为「商与余数」模式');
      });

      modeDecimalBtn.addEventListener('click', () => {
        state.divisionMode = 'decimal';
        try { localStorage.setItem(STORAGE_DIVMODE_KEY, 'decimal'); } catch (e) {}
        updateDivisionModeUI();
        showToast('已切换为「小数结果」模式');
      });

      // Theme toggle
      themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem(STORAGE_THEME_KEY, isDark ? 'dark' : 'light'); } catch (e) {}
        updateThemeIcons();
      });

      // History interactions (delegated)
      historyList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-history-index]');
        if (!btn) return;
        const idx = Number(btn.dataset.historyIndex);
        const item = state.history[idx];
        if (!item) return;

        state.error = null;
        state.decimalDisplay = null;
        state.currentInput = item.rawIntValue;
        state.waitingForOperand = false;
        state.subText = `已填入历史整数结果`;
        renderDisplay();
        showToast('已填入计算器');
      });

      clearHistoryBtn.addEventListener('click', () => {
        state.history = [];
        saveHistory();
        renderHistory();
        showToast('已清空历史记录');
      });

      // Keyboard support
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key;
        if (/^[0-9]$/.test(k)) {
          e.preventDefault();
          handleDigit(k);
          flashButton(k);
        } else if (k === '+' || k === '-' || k === '*' || k === '/') {
          e.preventDefault();
          handleOperator(k);
          flashButton(k);
        } else if (k === 'x' || k === 'X') {
          e.preventDefault();
          handleOperator('*');
          flashButton('*');
        } else if (k === 'Enter' || k === '=') {
          e.preventDefault();
          handleEquals();
          flashButton('Enter');
        } else if (k === 'Backspace') {
          e.preventDefault();
          handleBackspace();
          flashButton('Backspace');
        } else if (k === 'Escape' || k === 'Delete') {
          e.preventDefault();
          resetAll();
          flashButton('Escape');
        } else if (k === 'n' || k === 'N' || k === 'F9') {
          e.preventDefault();
          handleToggleSign();
          flashButton('±');
        }
      });

      // Init
      loadStorage();
      updateThemeIcons();
      updateDivisionModeUI();
      renderDisplay();
      renderHistory();
    })();
