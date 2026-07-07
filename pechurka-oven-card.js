/**
 * Pechurka Oven Card
 * Кастомная карточка Lovelace для умной духовки "Печурка" (Home Assistant)
 *
 * Особенности реализации:
 *  - DOM карточки строится ОДИН РАЗ (при первом получении hass), дальше только
 *    точечно обновляются значения — это исключает потерю фокуса в полях ввода.
 *  - DOM редактора строится ОДИН РАЗ. hass присваивается пикерам сущностей
 *    (ha-entity-picker) только при первом построении редактора — далее пикеры
 *    живут независимо от повторных вызовов сеттера hass и не сбрасываются.
 */

const CARD_TAG = "pechurka-oven-card";
const EDITOR_TAG = "pechurka-oven-card-editor";

const DEFAULT_CONFIG = {
  title: "Печурка",
  state_entity: "sensor.pechurka_state",
  program_entity: "select.r4s01_cooker_program",
  heat_mode_entity: "select.pechurka_heat_mode",
  temp_entity: "number.r4s01_cooker_temp",
  cook_hour_entity: "number.r4s01_cooker_s_hour",
  cook_min_entity: "number.r4s01_cooker_s_min",
  delay_hour_entity: "number.r4s01_cooker_d_hour",
  delay_min_entity: "number.r4s01_cooker_d_min",
  auto_warm_entity: "select.r4s01_cooker_auto_warming",
  switch_entity: "switch.r4s01_cooker_switch",
  remaining_hour_entity: "sensor.r4s01_cooker_hour",
  remaining_min_entity: "sensor.r4s01_cooker_min",
  rssi_entity: "sensor.r4s01_cooker_rssi",
};

// Список полей-сущностей, используемых и карточкой, и редактором.
const ENTITY_FIELDS = [
  { key: "state_entity", label: "Сущность состояния", domains: ["sensor"] },
  { key: "program_entity", label: "Программа", domains: ["select"] },
  { key: "heat_mode_entity", label: "Сторона нагрева", domains: ["select"] },
  { key: "temp_entity", label: "Температура", domains: ["number"] },
  { key: "cook_hour_entity", label: "Время готовки, часы", domains: ["number"] },
  { key: "cook_min_entity", label: "Время готовки, минуты", domains: ["number"] },
  { key: "delay_hour_entity", label: "Отложенный старт, часы", domains: ["number"] },
  { key: "delay_min_entity", label: "Отложенный старт, минуты", domains: ["number"] },
  { key: "auto_warm_entity", label: "Автоподогрев", domains: ["select"] },
  { key: "switch_entity", label: "Переключатель запуска", domains: ["switch"] },
  { key: "remaining_hour_entity", label: "Осталось часов", domains: ["sensor"] },
  { key: "remaining_min_entity", label: "Осталось минут", domains: ["sensor"] },
  { key: "rssi_entity", label: "Уровень сигнала (RSSI)", domains: ["sensor"] },
];

const HEAT_MODES = [
  { value: "Top", label: "Верх", icon: "mdi:menu-up" },
  { value: "Bottom", label: "Низ", icon: "mdi:menu-down" },
  { value: "Both", label: "Оба", icon: "mdi:menu-swap" },
];

function splitProgramLabel(raw) {
  // "Multicooker / Мультиповар" -> "Мультиповар"; "OFF" -> "Выкл."
  if (raw === "OFF") return "Выкл.";
  const parts = String(raw).split("/");
  return parts.length > 1 ? parts[1].trim() : raw;
}

function isUnavailable(hass, entityId) {
  const st = hass && entityId ? hass.states[entityId] : undefined;
  return !st || st.state === "unavailable" || st.state === "unknown";
}

function css() {
  return `
    ha-card {
      padding: 0;
      overflow: hidden;
    }
    .poc-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 16px 8px 16px;
    }
    .poc-header .poc-icon {
      --mdc-icon-size: 28px;
      color: var(--state-icon-color, var(--paper-item-icon-color));
    }
    .poc-title {
      font-size: 1.2em;
      font-weight: 500;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .poc-state-badge {
      font-size: 0.85em;
      padding: 3px 10px;
      border-radius: 12px;
      background: var(--divider-color);
      color: var(--primary-text-color);
      white-space: nowrap;
    }
    .poc-state-badge.running {
      background: var(--success-color, #4caf50);
      color: white;
    }
    .poc-state-badge.unavailable {
      background: var(--error-color, #db4437);
      color: white;
    }
    .poc-rssi {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 0.75em;
      color: var(--secondary-text-color);
    }
    .poc-rssi ha-icon {
      --mdc-icon-size: 16px;
    }
    .poc-body {
      padding: 4px 16px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .poc-row-label {
      font-size: 0.85em;
      color: var(--secondary-text-color);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .poc-heatmode {
      display: flex;
      gap: 8px;
    }
    .poc-heatmode button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 4px;
      border-radius: 10px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
      font-size: 0.8em;
    }
    .poc-heatmode button ha-icon {
      --mdc-icon-size: 22px;
      color: var(--secondary-text-color);
    }
    .poc-heatmode button.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: white;
    }
    .poc-heatmode button.active ha-icon {
      color: white;
    }
    .poc-heatmode button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    select.poc-select {
      width: 100%;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font: inherit;
      font-size: 0.95em;
    }
    .poc-temp-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .poc-temp-row input[type="range"] {
      flex: 1;
      accent-color: var(--primary-color);
    }
    .poc-temp-value {
      min-width: 58px;
      text-align: right;
      font-weight: 600;
      font-size: 1.05em;
    }
    .poc-time-group {
      display: flex;
      gap: 20px;
    }
    .poc-time-field {
      flex: 1;
    }
    .poc-time-field .poc-unit-label {
      font-size: 0.72em;
      color: var(--secondary-text-color);
    }
    .poc-time-inputs {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .poc-time-inputs input[type="number"] {
      width: 100%;
      text-align: center;
      padding: 8px 2px;
      border-radius: 8px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font: inherit;
      font-size: 0.95em;
    }
    .poc-time-inputs .poc-colon {
      font-weight: 600;
      color: var(--secondary-text-color);
    }
    .poc-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .poc-switch-label {
      font-size: 0.95em;
    }
    ha-switch[disabled] {
      opacity: 0.4;
    }
    .poc-remaining {
      font-size: 0.85em;
      color: var(--secondary-text-color);
    }
    .poc-start-btn {
      width: 100%;
      padding: 14px;
      border-radius: 10px;
      border: none;
      font: inherit;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--primary-color);
      color: white;
    }
    .poc-start-btn.running {
      background: var(--error-color, #db4437);
    }
    .poc-start-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    input:disabled, select:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;
}

class PechurkaOvenCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return { type: `custom:${CARD_TAG}`, ...DEFAULT_CONFIG };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Некорректная конфигурация карточки");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._built = false;
    if (this._hass) {
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) {
      this._render();
    } else {
      this._update();
    }
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 6;
  }

  connectedCallback() {
    if (this._config && this._hass && !this._built) {
      this._render();
    }
  }

  // ---- построение DOM карточки (вызывается один раз) ----
  _render() {
    const cfg = this._config;
    this.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = css();
    this.appendChild(style);

    const card = document.createElement("ha-card");

    // header
    const header = document.createElement("div");
    header.className = "poc-header";
    header.innerHTML = `
      <ha-icon class="poc-icon" icon="mdi:pot-steam-outline"></ha-icon>
      <div class="poc-title">${cfg.title}</div>
      <div class="poc-rssi"><ha-icon icon="mdi:wifi"></ha-icon><span class="poc-rssi-value">—</span></div>
      <div class="poc-state-badge">—</div>
    `;
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "poc-body";

    // heat mode
    const heatWrap = document.createElement("div");
    heatWrap.innerHTML = `<div class="poc-row-label"><span>Сторона нагрева</span></div>`;
    const heatButtons = document.createElement("div");
    heatButtons.className = "poc-heatmode";
    HEAT_MODES.forEach((m) => {
      const btn = document.createElement("button");
      btn.dataset.value = m.value;
      btn.innerHTML = `<ha-icon icon="${m.icon}"></ha-icon><span>${m.label}</span>`;
      btn.addEventListener("click", () => this._callSelect(cfg.heat_mode_entity, m.value));
      heatButtons.appendChild(btn);
    });
    heatWrap.appendChild(heatButtons);
    body.appendChild(heatWrap);

    // program
    const progWrap = document.createElement("div");
    progWrap.innerHTML = `<div class="poc-row-label"><span>Программа</span></div>`;
    const progSelect = document.createElement("select");
    progSelect.className = "poc-select";
    progSelect.addEventListener("change", (e) => this._callSelect(cfg.program_entity, e.target.value));
    progWrap.appendChild(progSelect);
    body.appendChild(progWrap);

    // temperature
    const tempWrap = document.createElement("div");
    tempWrap.innerHTML = `<div class="poc-row-label"><span>Температура</span></div>`;
    const tempRow = document.createElement("div");
    tempRow.className = "poc-temp-row";
    const tempSlider = document.createElement("input");
    tempSlider.type = "range";
    tempSlider.min = "0";
    tempSlider.max = "230";
    tempSlider.step = "1";
    const tempValue = document.createElement("div");
    tempValue.className = "poc-temp-value";
    tempValue.textContent = "— °C";
    let tempDebounce = null;
    tempSlider.addEventListener("input", () => {
      tempValue.textContent = `${tempSlider.value} °C`;
    });
    tempSlider.addEventListener("change", () => {
      clearTimeout(tempDebounce);
      this._callNumber(cfg.temp_entity, tempSlider.value);
    });
    tempRow.appendChild(tempSlider);
    tempRow.appendChild(tempValue);
    tempWrap.appendChild(tempRow);
    body.appendChild(tempWrap);

    // cook time
    const cookWrap = document.createElement("div");
    cookWrap.className = "poc-time-field";
    cookWrap.innerHTML = `<div class="poc-row-label"><span>Время готовки</span></div>`;
    const cookInputs = document.createElement("div");
    cookInputs.className = "poc-time-inputs";
    const cookHour = document.createElement("input");
    cookHour.type = "number";
    cookHour.min = "0";
    cookHour.max = "23";
    const cookMin = document.createElement("input");
    cookMin.type = "number";
    cookMin.min = "0";
    cookMin.max = "59";
    cookHour.addEventListener("change", () => this._callNumber(cfg.cook_hour_entity, cookHour.value));
    cookMin.addEventListener("change", () => this._callNumber(cfg.cook_min_entity, cookMin.value));
    cookInputs.appendChild(cookHour);
    cookInputs.appendChild(document.createElement("span")).className = "poc-colon";
    cookInputs.lastChild.textContent = "ч";
    cookInputs.appendChild(cookMin);
    const cookMinLabel = document.createElement("span");
    cookMinLabel.className = "poc-colon";
    cookMinLabel.textContent = "м";
    cookInputs.appendChild(cookMinLabel);
    cookWrap.appendChild(cookInputs);

    // delay start
    const delayWrap = document.createElement("div");
    delayWrap.className = "poc-time-field";
    delayWrap.innerHTML = `<div class="poc-row-label"><span>Отложенный старт</span></div>`;
    const delayInputs = document.createElement("div");
    delayInputs.className = "poc-time-inputs";
    const delayHour = document.createElement("input");
    delayHour.type = "number";
    delayHour.min = "0";
    delayHour.max = "23";
    const delayMin = document.createElement("input");
    delayMin.type = "number";
    delayMin.min = "0";
    delayMin.max = "59";
    delayHour.addEventListener("change", () => this._callNumber(cfg.delay_hour_entity, delayHour.value));
    delayMin.addEventListener("change", () => this._callNumber(cfg.delay_min_entity, delayMin.value));
    delayInputs.appendChild(delayHour);
    const delayColon = document.createElement("span");
    delayColon.className = "poc-colon";
    delayColon.textContent = "ч";
    delayInputs.appendChild(delayColon);
    delayInputs.appendChild(delayMin);
    const delayMinLabel = document.createElement("span");
    delayMinLabel.className = "poc-colon";
    delayMinLabel.textContent = "м";
    delayInputs.appendChild(delayMinLabel);
    delayWrap.appendChild(delayInputs);

    const timeGroup = document.createElement("div");
    timeGroup.className = "poc-time-group";
    timeGroup.appendChild(cookWrap);
    timeGroup.appendChild(delayWrap);
    body.appendChild(timeGroup);

    // auto warming
    const warmWrap = document.createElement("div");
    warmWrap.className = "poc-switch-row";
    warmWrap.innerHTML = `<span class="poc-switch-label">Автоподогрев</span>`;
    const warmSwitch = document.createElement("ha-switch");
    warmSwitch.addEventListener("change", (e) =>
      this._callSelect(cfg.auto_warm_entity, e.target.checked ? "ON" : "OFF")
    );
    warmWrap.appendChild(warmSwitch);
    body.appendChild(warmWrap);

    // remaining time
    const remaining = document.createElement("div");
    remaining.className = "poc-remaining";
    remaining.textContent = "";
    body.appendChild(remaining);

    // start button
    const startBtn = document.createElement("button");
    startBtn.className = "poc-start-btn";
    startBtn.innerHTML = `<ha-icon icon="mdi:clock-start"></ha-icon><span>Запустить</span>`;
    startBtn.addEventListener("click", () => this._toggleSwitch());
    body.appendChild(startBtn);

    card.appendChild(body);
    this.appendChild(card);

    // сохраняем ссылки на элементы для точечных обновлений
    this._els = {
      stateBadge: header.querySelector(".poc-state-badge"),
      rssiValue: header.querySelector(".poc-rssi-value"),
      heatButtons: Array.from(heatButtons.children),
      progSelect,
      tempSlider,
      tempValue,
      cookHour,
      cookMin,
      delayHour,
      delayMin,
      warmSwitch,
      remaining,
      startBtn,
    };
    this._progOptionsSet = false;
    this._built = true;
    this._update();
  }

  // ---- точечное обновление значений (без пересоздания DOM) ----
  _update() {
    const hass = this._hass;
    const cfg = this._config;
    const els = this._els;
    if (!hass || !els) return;

    const stateSt = hass.states[cfg.state_entity];
    const overallUnavailable = isUnavailable(hass, cfg.switch_entity);

    // state badge
    const stateText = stateSt && stateSt.state !== "unavailable" && stateSt.state !== "unknown"
      ? stateSt.state
      : "Недоступно";
    els.stateBadge.textContent = stateText;
    els.stateBadge.classList.toggle("unavailable", overallUnavailable);
    els.stateBadge.classList.toggle(
      "running",
      !overallUnavailable && hass.states[cfg.switch_entity] && hass.states[cfg.switch_entity].state === "on"
    );

    // rssi
    const rssiSt = hass.states[cfg.rssi_entity];
    els.rssiValue.textContent = rssiSt && rssiSt.state !== "unavailable" ? `${rssiSt.state} dBm` : "—";

    // heat mode buttons
    const heatSt = hass.states[cfg.heat_mode_entity];
    const heatUnavailable = isUnavailable(hass, cfg.heat_mode_entity);
    els.heatButtons.forEach((btn) => {
      btn.disabled = heatUnavailable;
      btn.classList.toggle("active", !heatUnavailable && heatSt && heatSt.state === btn.dataset.value);
    });

    // program select — заполняем опции один раз (или если список опций изменился)
    const progSt = hass.states[cfg.program_entity];
    const progUnavailable = isUnavailable(hass, cfg.program_entity);
    els.progSelect.disabled = progUnavailable;
    if (!progUnavailable && progSt && progSt.attributes && progSt.attributes.options) {
      const opts = progSt.attributes.options;
      const currentOptionValues = Array.from(els.progSelect.options).map((o) => o.value);
      const same =
        currentOptionValues.length === opts.length && opts.every((o, i) => o === currentOptionValues[i]);
      if (!same) {
        els.progSelect.innerHTML = "";
        opts.forEach((opt) => {
          const optionEl = document.createElement("option");
          optionEl.value = opt;
          optionEl.textContent = splitProgramLabel(opt);
          els.progSelect.appendChild(optionEl);
        });
      }
      if (document.activeElement !== els.progSelect) {
        els.progSelect.value = progSt.state;
      }
    }

    // temperature — не трогаем, если пользователь сейчас двигает слайдер
    const tempSt = hass.states[cfg.temp_entity];
    const tempUnavailable = isUnavailable(hass, cfg.temp_entity);
    els.tempSlider.disabled = tempUnavailable;
    if (!tempUnavailable && document.activeElement !== els.tempSlider) {
      els.tempSlider.value = tempSt.state;
      els.tempValue.textContent = `${tempSt.state} °C`;
    } else if (tempUnavailable) {
      els.tempValue.textContent = "— °C";
    }

    // cook time
    this._syncNumberInput(els.cookHour, hass.states[cfg.cook_hour_entity]);
    this._syncNumberInput(els.cookMin, hass.states[cfg.cook_min_entity]);
    this._syncNumberInput(els.delayHour, hass.states[cfg.delay_hour_entity]);
    this._syncNumberInput(els.delayMin, hass.states[cfg.delay_min_entity]);

    // auto warming
    const warmSt = hass.states[cfg.auto_warm_entity];
    const warmUnavailable = isUnavailable(hass, cfg.auto_warm_entity);
    els.warmSwitch.disabled = warmUnavailable;
    if (!warmUnavailable) {
      els.warmSwitch.checked = warmSt.state === "ON";
    }

    // remaining time
    const rh = hass.states[cfg.remaining_hour_entity];
    const rm = hass.states[cfg.remaining_min_entity];
    if (rh && rm && rh.state !== "unavailable" && rm.state !== "unknown" && rh.state !== "unknown") {
      const switchSt = hass.states[cfg.switch_entity];
      if (switchSt && switchSt.state === "on") {
        els.remaining.textContent = `Осталось: ${rh.state} ч ${rm.state} м`;
      } else {
        els.remaining.textContent = "";
      }
    } else {
      els.remaining.textContent = "";
    }

    // start button
    const switchSt = hass.states[cfg.switch_entity];
    const switchUnavailable = isUnavailable(hass, cfg.switch_entity);
    els.startBtn.disabled = switchUnavailable;
    const running = !switchUnavailable && switchSt.state === "on";
    els.startBtn.classList.toggle("running", running);
    els.startBtn.querySelector("span").textContent = running ? "Остановить" : "Запустить";
    els.startBtn.querySelector("ha-icon").setAttribute("icon", running ? "mdi:stop" : "mdi:clock-start");
  }

  _syncNumberInput(inputEl, stateObj) {
    const unavailable = !stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown";
    inputEl.disabled = unavailable;
    if (!unavailable && document.activeElement !== inputEl) {
      inputEl.value = stateObj.state;
    }
  }

  _callSelect(entityId, option) {
    if (!entityId || !this._hass) return;
    this._hass.callService("select", "select_option", { entity_id: entityId, option });
  }

  _callNumber(entityId, value) {
    if (!entityId || !this._hass) return;
    this._hass.callService("number", "set_value", { entity_id: entityId, value: Number(value) });
  }

  _toggleSwitch() {
    const cfg = this._config;
    const hass = this._hass;
    if (!hass || !cfg.switch_entity) return;
    const st = hass.states[cfg.switch_entity];
    const isOn = st && st.state === "on";
    hass.callService("switch", isOn ? "turn_off" : "turn_on", { entity_id: cfg.switch_entity });
  }
}

// ------------------------------------------------------------------
// РЕДАКТОР КАРТОЧКИ
// DOM строится один раз. hass присваивается ha-entity-picker'ам
// только при первом построении — далее пикеры не пересоздаются
// и не получают hass повторно, что бы избежать сброса их состояния.
// ------------------------------------------------------------------
class PechurkaOvenCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    if (this._built) {
      this._syncFormValues();
    } else if (this._hass) {
      this._buildForm();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built && this._config) {
      this._buildForm();
    }
    // ВАЖНО: при последующих вызовах hass НЕ переприсваиваем его пикерам —
    // они уже построены и работают независимо.
  }

  connectedCallback() {
    if (this._config && this._hass && !this._built) {
      this._buildForm();
    }
  }

  _buildForm() {
    this.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `
      .poc-editor { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
      .poc-editor-title-field { margin-bottom: 4px; }
      .poc-editor-title-field input {
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font: inherit;
      }
      .poc-editor-label {
        font-size: 0.8em;
        color: var(--secondary-text-color);
        margin-bottom: 2px;
      }
    `;
    this.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "poc-editor";

    // title field
    const titleField = document.createElement("div");
    titleField.className = "poc-editor-title-field";
    titleField.innerHTML = `<div class="poc-editor-label">Заголовок карточки</div>`;
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = this._config.title || "";
    titleInput.addEventListener("change", () => {
      this._config = { ...this._config, title: titleInput.value };
      this._fireConfigChanged();
    });
    titleField.appendChild(titleInput);
    wrap.appendChild(titleField);
    this._titleInput = titleInput;

    // entity pickers, built once, hass assigned once
    this._pickers = {};
    ENTITY_FIELDS.forEach((field) => {
      const fieldWrap = document.createElement("div");
      const label = document.createElement("div");
      label.className = "poc-editor-label";
      label.textContent = field.label;
      fieldWrap.appendChild(label);

      const picker = document.createElement("ha-entity-picker");
      picker.hass = this._hass; // присваивается один раз, при первом построении
      picker.allowCustomEntity = true;
      if (field.domains) {
        picker.includeDomains = field.domains;
      }
      picker.value = this._config[field.key] || "";
      picker.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const newValue = ev.detail.value;
        this._config = { ...this._config, [field.key]: newValue };
        this._fireConfigChanged();
      });

      fieldWrap.appendChild(picker);
      wrap.appendChild(fieldWrap);
      this._pickers[field.key] = picker;
    });

    this.appendChild(wrap);
    this._built = true;
  }

  // при изменении config извне (например, YAML-редактор) синхронизируем
  // значения полей, не пересоздавая пикеры и не трогая их hass
  _syncFormValues() {
    if (!this._built) return;
    if (this._titleInput && this._titleInput.value !== (this._config.title || "")) {
      this._titleInput.value = this._config.title || "";
    }
    ENTITY_FIELDS.forEach((field) => {
      const picker = this._pickers[field.key];
      const val = this._config[field.key] || "";
      if (picker && picker.value !== val) {
        picker.value = val;
      }
    });
  }

  _fireConfigChanged() {
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, PechurkaOvenCard);
}
if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, PechurkaOvenCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Pechurka Oven Card",
  description: "Карточка управления умной духовкой Печурка: программы, температура, время готовки, отложенный старт, сторона нагрева.",
  preview: false,
});
