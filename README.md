# Redmond Oven Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
![GitHub release](https://img.shields.io/github/v/release/undel-gh/Redmond-oven-card)
![License](https://img.shields.io/github/license/undel-gh/Redmond-oven-card)

Кастомная карточка Lovelace для Home Assistant для управления умной духовкой **Redmond («Печурка»)**, подключённой через шлюз `r4s0.Gate`.

Карточка объединяет в едином интерфейсе управление стороной нагрева, выбор программы приготовления, температуру, время готовки, отложенный старт и отображение текущего состояния духовки — без необходимости собирать несколько стандартных карточек entities/tile вручную.

Пример карточки:

<img width="402" height="419" alt="image" src="https://github.com/user-attachments/assets/1ec94b61-12eb-4618-a0bb-6808690fc77a" />

## Возможности

- **Текущее состояние** духовки и уровень сигнала (RSSI) в шапке карточки.
- **Сторона нагрева** — переключатель Верх / Низ / Оба тэна.
- **Программа приготовления** — выпадающий список со всеми доступными программами (Мультиповар, Омлет, Томление, Хлеб, Пицца, Жаркое и т.д.).
- **Температура** — слайдер 0–230 °C.
- **Время готовки** — часы и минуты.
- **Отложенный старт** — часы и минуты.
- **Автоподогрев** — переключатель ON/OFF.
- **Кнопка запуска/остановки** приготовления с индикацией текущего статуса.
- **Отображение оставшегося времени** во время работы.
- Устойчивый редактор карточки: все поля настраиваются визуально, без необходимости писать YAML вручную.
- Корректная обработка состояния `unavailable`, если духовка временно недоступна по сети.

## Установка

### Через HACS (рекомендуется)

1. Откройте HACS → **Frontend**.
2. Нажмите на меню (⋮) → **Custom repositories**.
3. Добавьте репозиторий: `https://github.com/undel-gh/Redmond-oven-card`, категория **Lovelace**.
4. Найдите **Redmond Oven Card** в списке и нажмите **Install**.
5. Перезагрузите браузер (Ctrl+F5), если карточка не появилась в списке сразу.

### Вручную

1. Скачайте файл [`pechurka-oven-card.js`](pechurka-oven-card.js) из последнего [релиза](https://github.com/undel-gh/Redmond-oven-card/releases).
2. Поместите его в папку `www/community/redmond-oven-card/` внутри конфигурации Home Assistant.
3. Добавьте ресурс в **Настройки → Панели управления → Ресурсы**:

   ```yaml
   url: /hacsfiles/redmond-oven-card/pechurka-oven-card.js
   type: module
   ```

   (при ручной установке путь будет `/local/community/redmond-oven-card/pechurka-oven-card.js`)

## Использование

Добавьте карточку через визуальный редактор дашборда, выбрав **Redmond Oven Card**, либо пропишите YAML вручную:

```yaml
type: custom:pechurka-oven-card
title: Печурка
state_entity: sensor.pechurka_state
program_entity: select.r4s01_cooker_program
heat_mode_entity: select.pechurka_heat_mode
temp_entity: number.r4s01_cooker_temp
cook_hour_entity: number.r4s01_cooker_s_hour
cook_min_entity: number.r4s01_cooker_s_min
delay_hour_entity: number.r4s01_cooker_d_hour
delay_min_entity: number.r4s01_cooker_d_min
auto_warm_entity: select.r4s01_cooker_auto_warming
switch_entity: switch.r4s01_cooker_switch
remaining_hour_entity: sensor.r4s01_cooker_hour
remaining_min_entity: sensor.r4s01_cooker_min
rssi_entity: sensor.r4s01_cooker_rssi
```

Все поля, кроме `type`, необязательны — при отсутствии используются сущности по умолчанию, соответствующие стандартной интеграции `r4s0`/`pechurka`. Если ваши сущности называются иначе, укажите свои `entity_id` через визуальный редактор карточки (значок ✏️) или в YAML.

### Параметры конфигурации

| Параметр                 | Описание                                   | Домен entity |
|---------------------------|---------------------------------------------|--------------|
| `title`                    | Заголовок карточки                          | —            |
| `state_entity`              | Текущее состояние духовки                    | `sensor`     |
| `program_entity`            | Программа приготовления                      | `select`     |
| `heat_mode_entity`          | Сторона нагрева (Top/Bottom/Both)            | `select`     |
| `temp_entity`               | Температура                                  | `number`     |
| `cook_hour_entity`          | Время готовки, часы                          | `number`     |
| `cook_min_entity`           | Время готовки, минуты                        | `number`     |
| `delay_hour_entity`         | Отложенный старт, часы                       | `number`     |
| `delay_min_entity`          | Отложенный старт, минуты                     | `number`     |
| `auto_warm_entity`          | Автоподогрев (ON/OFF)                         | `select`     |
| `switch_entity`             | Переключатель запуска приготовления           | `switch`     |
| `remaining_hour_entity`     | Осталось часов до готовности                  | `sensor`     |
| `remaining_min_entity`      | Осталось минут до готовности                  | `sensor`     |
| `rssi_entity`               | Уровень сигнала устройства                    | `sensor`     |

## Требования

- Home Assistant 2023.x и новее.
- Духовка Redmond («Печурка»), подключённая через шлюз `r4s0.Gate` и предоставляющая соответствующие сущности `number`, `select`, `switch`, `sensor`.

## Известные особенности реализации

- DOM карточки строится один раз при первом получении объекта `hass`; последующие обновления состояния точечно обновляют значения элементов, не пересоздавая интерфейс — это предотвращает потерю фокуса при вводе значений (например, температуры или времени).
- В визуальном редакторе карточки объект `hass` передаётся полям выбора сущности (`ha-entity-picker`) только при первом построении формы. Дальнейшие обновления `hass` не переприсваиваются пикерам, чтобы их внутреннее состояние не сбрасывалось.

## Обратная связь

Нашли баг или есть предложение по улучшению? Создайте [issue](https://github.com/undel-gh/Redmond-oven-card/issues) в репозитории.

## Лицензия

Проект распространяется под лицензией [MIT](LICENSE).
