/**
 * Дополнительный словарь i18n (модуль DEMO_DICTS): демо-данные с РЕАЛЬНЫМИ
 * фактами о пестицидах и медосборе + GDD-справка по медоносам.
 *
 * Источники (проверены через открытые публикации):
 *  — «Каратэ Зеон» (лямбда-цигалотрин, класс опасности для пчёл I): обработка
 *    вечером после захода солнца при ветре не более 1–2 м/с, защитная зона
 *    лёта пчёл 4–5 км (инструкция/регламент применения);
 *  — уведомление о обработках: не позднее чем за 5 дней и не ранее чем за 10
 *    дней, пасеки в радиусе до 7 км (изменения 2023 года);
 *  — пиретроиды применяют при +10…+20 °C (регламент защиты рапса);
 *  — прецедент: Башкирия, 2019 — массовая гибель после обработки рапса
 *    (40–45 тыс. пчёл, по оценке Ассоциации переработчиков мёда);
 *  — медопродуктивность: липа 800–1000 кг/га (семья до 10–15 кг в день),
 *    гречиха 60–360 кг/га (3–7 кг в день), подсолнечник 13–57 кг/га.
 *
 * Переведены ВСЕ пользовательские строки демо-режима: предписания
 * (demo.finding.*), доказательства (demo.evidence.*), метки сенсоров и basis
 * (demo.evidence.sensor.*, demo.basis.*), поля улья (demo.hive.*), медоносы
 * (demo.crop.*), вечерний отчет (demo.evening.*), подписи графиков
 * (demo.chart.*), единицы (demo.unit.*) и хелперы статусов (demo.voc.*,
 * demo.traffic.*). Русский канонический текст остается в demo-hives.ts и
 * служит фолбэком: tf(key, fallback, vars) — отсутствующий перевод падает
 * на строку данных, а не на ключ.
 */
import type { Dict, Lang } from './i18n'

const RU: Dict = {
  // ── Пестицидный баннер и GDD-справка (факты; переопределяют базу) ──
  'dash.pesticide.text':
    '20 июля поле рапса «Заречное» обработают инсектицидом «Каратэ Зеон» (лямбда-цигалотрин — I класс опасности для пчёл). Поле в 2,4 км, ветер в сторону пасеки.',
  'dash.pesticide.desc':
    'Пиретроид «Каратэ Зеон» высокоопасен для пчёл (I класс): регламент разрешает обработку вечером после захода солнца при ветре не выше 1–2 м/с. По закону о применении пестицидов пчеловодов уведомляют за 10–5 дней, а все пасеки в радиусе до 7 км обязаны получить извещение.',
  'dash.pesticide.step1':
    'Уточните окно обработки: пиретроиды применяют при +10…+20 °C, обычно вечером после захода солнца при ветре до 1–2 м/с — успеть до вылета фуражиров.',
  'dash.pesticide.step2':
    'Вариант «переезд»: вывезти пасеку на 5–7 км от поля «Заречное» — за пределы защитной зоны лёта пчёл (раздел «Кочёвка» составит план).',
  'dash.pesticide.step4':
    'После обработки: контролировать прилёт пчёл; при массовой гибели собрать пробы и уведомить администрацию района. Прецедент: Башкирия, 2019 — после обработки рапса погибло 40–45 тыс. пчёл.',
  'dash.gdd.note.acacia': 'первый сильный взяток',
  'dash.gdd.note.sunflower': '13–57 кг/га, валовый сбор до 60 кг',
  'dash.gdd.note.linden': 'до 800–1000 кг/га, семья берёт 10–15 кг за день',
  'dash.gdd.note.buckwheat': '60–360 кг/га, взяток 3–7 кг в день',

  // ── Медоносы (GDD_CROPS) ──
  'demo.crop.acacia': 'Акация',
  'demo.crop.sunflower': 'Подсолнечник',
  'demo.crop.linden': 'Липа',
  'demo.crop.buckwheat': 'Гречиха',

  // ── Метки сенсоров доказательств (EVIDENCE_SENSOR_LABEL) ──
  'demo.evidence.sensor.scales': 'Умные весы',
  'demo.evidence.sensor.mic': 'Акустика',
  'demo.evidence.sensor.cam': 'Камера на летке',
  'demo.evidence.sensor.gas': 'Газовый сенсор',
  'demo.evidence.sensor.temp': 'Термодатчик',
  'demo.evidence.sensor.hum': 'Гигрометр',
  'demo.evidence.sensor.gdd': 'GDD-календарь',
  'demo.evidence.sensor.weather': 'Прогноз погоды',
  'demo.evidence.sensor.stats': 'Статистика обработок',

  // ── Метки сенсоров из basis[] предписаний (BASIS_KEY) ──
  'demo.basis.scales': 'Весы',
  'demo.basis.mic': 'Акустика',
  'demo.basis.cam': 'Камера',
  'demo.basis.temp': 'Термодатчик',
  'demo.basis.gdd': 'GDD',
  'demo.basis.stats': 'Статистика обработок',
  'demo.basis.weather': 'Прогноз погоды',
  'demo.basis.hum': 'Гигрометр',
  'demo.basis.gas': 'Газовый сенсор',

  // ── Хелперы состояния воздуха и трафика (vocState / trafficState) ──
  'demo.voc.hot': 'Духота — семье не хватает объема',
  'demo.voc.mid': 'Умеренная загрузка воздухом',
  'demo.voc.ok': 'Воздух чистый',
  'demo.traffic.high': 'Интенсивный лёт',
  'demo.traffic.active': 'Активный лёт',
  'demo.traffic.weak': 'Лёт ослаблен',
  'demo.traffic.low': 'Лёт резко снижен',

  // ── Поля ульев (паспорт, леток, акустика, корпуса, матка) ──
  'demo.hive.0.label': 'Вся пасека',
  'demo.hive.0.scenarioHint': 'Средние показатели пасеки · 1 улей с критической заклещенностью, 1 предроевой',
  'demo.hive.0.entranceLabel': 'Лёт активный по пасеке',
  'demo.hive.0.acousticLabel': 'Средний гул пасеки — работа на взятке',
  'demo.hive.0.corps': '4 улья · 12 корпусов · 1 магазин',
  'demo.hive.1.label': 'Улей №1',
  'demo.hive.1.scenarioHint': 'Индекс 9,2 · заклещенность 0,8 % · стабильный взяток',
  'demo.hive.1.entranceLabel': 'Активный лёт',
  'demo.hive.1.acousticLabel': 'Ровный гул семьи — норма',
  'demo.hive.1.corps': '3 корпуса (дадан)',
  'demo.hive.1.queenBreed': 'Карника',
  'demo.hive.1.queenMark': 'синяя метка',
  'demo.hive.2.label': 'Улей №2',
  'demo.hive.2.scenarioHint': 'Индекс 8,8 · привес +480 г/сут · влажность 50 % (сушка нектара)',
  'demo.hive.2.entranceLabel': 'Интенсивный лёт — пик взятка',
  'demo.hive.2.acousticLabel': 'Вентиляция: сушка свежего нектара',
  'demo.hive.2.corps': '3 корпуса + 1 магазин (дадан)',
  'demo.hive.2.queenBreed': 'Бакфаст',
  'demo.hive.2.queenMark': 'зелёная метка',
  'demo.hive.3.label': 'Улей №3',
  'demo.hive.3.scenarioHint': 'Индекс 4,8 · заклещенность 3,6 % · риск вируса деформации крыла',
  'demo.hive.3.entranceLabel': 'Лёт ослаблен (−30 % к пасеке)',
  'demo.hive.3.acousticLabel': 'Гул с неровным тоном — семья тревожится',
  'demo.hive.3.corps': '3 корпуса (дадан)',
  'demo.hive.3.queenBreed': 'Карника',
  'demo.hive.3.queenMark': 'жёлтая метка',
  'demo.hive.4.label': 'Улей №4',
  'demo.hive.4.scenarioHint': 'Индекс 5,5 · маточники 41 °C · пение маток · «борода» на летке',
  'demo.hive.4.entranceLabel': 'Скопление пчел «бородой» — риск роения',
  'demo.hive.4.acousticLabel': 'Пение маток: выход роя через 3–5 дней',
  'demo.hive.4.corps': '3 корпуса (дадан)',
  'demo.hive.4.queenBreed': 'Местная среднерусская',
  'demo.hive.4.queenMark': 'без метки',

  // ── Предписания: сценарий «Норма» ──
  'demo.finding.n1.title': 'Семья развивается штатно',
  'demo.finding.n1.summary': 'Все шесть групп датчиков в норме — продолжать наблюдение, вмешательство не требуется.',
  'demo.finding.n1.urgencyNote': 'Наблюдать',
  'demo.finding.n1.probability': 'Отклонений не обнаружено',
  'demo.finding.n1.risk':
    'Риск отсутствует: при сохранении текущих показателей семья продолжит наращивать силу без потерь. Следующая контрольная точка — плановый осмотр через 7 дней.',
  'demo.finding.n1.action': 'Отметить: плановый осмотр выполнен',
  'demo.evidence.n1.0':
    'Весы: плавный привес +0,16…+0,19 кг/сут 5 дней подряд — без провалов и скачков (порог тишины ±150 г отсек ветер и дождь).',
  'demo.evidence.n1.1':
    'Термодатчик: 35,0 °C в расплодной части — температура постоянна, как и положено (норма). Периферия на 1–2 °C ниже, кормовая часть ≈ 30 °C.',
  'demo.evidence.n1.2': 'Акустика: ровный гул 215 Гц — семья спокойна, ни вентиляции, ни пения маток.',
  'demo.evidence.n1.3': 'Камера на летке: 0 клещей на спинках за смену, трафик 42 пч/мин — лёт полноценный.',

  'demo.finding.n2.title': 'Пора поставить магазинную надставку',
  'demo.finding.n2.summary': 'Свободных сотов осталось меньше двух рамок — семья скоро упрется в потолок объема.',
  'demo.finding.n2.urgencyNote': 'В течение недели',
  'demo.finding.n2.probability': 'Вероятность нехватки сотов — 82 %',
  'demo.finding.n2.risk':
    'Через 5–8 дней все соты займут мед и расплод: семья ограничит матку в яйцекладке, темп медосбора упадет на 20–30 %, а теснота подтолкнет к роению.',
  'demo.finding.n2.action': 'Расширить гнездо / поставить магазины',
  'demo.evidence.n2.0':
    'Весы: +0,17 кг/сут стабильно — семья приносит нектар каждый день и заняла под мед почти весь верхний корпус.',
  'demo.evidence.n2.1':
    'Камера: принос обножки у 6 из 10 возвращающихся пчел — сильный взяток продолжится, объем понадобится уже через 3–4 дня.',
  'demo.evidence.n2.2': 'GDD-календарь: сумма температур достигла порога цветения акации — приток нектара усилится.',

  'demo.finding.n3.title': 'Заклещенность в норме — лечения не требуется',
  'demo.finding.n3.summary': '0,8 % — вдвое ниже порога риска. Химия сейчас только потревожит семью на взятке.',
  'demo.finding.n3.urgencyNote': 'Наблюдать',
  'demo.finding.n3.probability': 'Прогноз +14 дней: 0,9 % — по-прежнему норма',
  'demo.finding.n3.risk':
    'Без новых обработок к сентябрю заклещенность достигнет ~1,3 % — остается в безопасной зоне. Риск вируса деформации крыла минимален.',
  'demo.finding.n3.action': 'Запланировать контрольный подсчет через 14 дней',
  'demo.evidence.n3.0':
    'Камера: 0 клещей на спинках пчел за смену наблюдения (до 3 в день считалось бы тревожным).',
  'demo.evidence.n3.1':
    'График заклещенности: после июньской обработки щавелевой кислотой показатель держится 0,7–0,8 % уже 12 дней — обработка сработала.',
  'demo.evidence.n3.2': 'Весы дают устойчивый привес — семья сильная, ослабления от клеща нет.',

  'demo.finding.n4.title': 'Завтра отличное окно лёта',
  'demo.finding.n4.summary':
    'До +24 °C, ветер до 3 м/с, осадки 10 % — максимум вылета фуражиров, осмотры лучше не планировать.',
  'demo.finding.n4.urgencyNote': 'Использовать окно лёта',
  'demo.finding.n4.probability': 'По прогнозу на 10 дней',
  'demo.finding.n4.risk':
    'Пропуск окна не опасен, но потеряется 1 день взятка: при привесе +180 г/сут это ~0,2 кг меда только по одному улью.',
  'demo.finding.n4.action': 'Отметить: осмотр отложен на послезавтра',
  'demo.evidence.n4.0':
    'Прогноз: завтра ясно до +24 °C, ветер 3 м/с, вероятность осадков 10 % — лётные условия «good».',
  'demo.evidence.n4.1':
    'Весы: утренний сброс −1,1 кг и быстрое восстановление к вечеру — фуражиры работают полный день.',

  // ── Предписания: сценарий «Активный медосбор» ──
  'demo.finding.f1.title': 'Активный медосбор — семья работает на липу',
  'demo.finding.f1.summary':
    'Привес +480 г/сут, семья перешла в режим сушки нектара. Пора дать объем под свежий мед.',
  'demo.finding.f1.urgencyNote': 'Сегодня',
  'demo.finding.f1.probability': 'Вероятность устойчивого взятка — 91 %',
  'demo.finding.f1.risk':
    'Через 3–5 дней при таком темпе соты заполнятся: без дополнительного объема семья ограничит матку, а нектар начнет терять влагу медленно — риск закисания при смене погоды.',
  'demo.finding.f1.action': 'Расширить гнездо / поставить магазины',
  'demo.evidence.f1.0':
    'Весы: привес +460…+480 г/сут 3 дня подряд — заметно выше порога тишины ±150 г, это не ветер и не влага.',
  'demo.evidence.f1.1':
    'Гигрометр: влажность расплодной части у верхней границы нормы — 50 % (норма 40–50 %) при сухой погоде снаружи (52 %) — семья залила соты свежим нектаром и включила сушку.',
  'demo.evidence.f1.2': 'Акустика: гул сместился на 265 Гц — семья включила вентиляцию для сушки нектара.',
  'demo.evidence.f1.3':
    'GDD-календарь: сумма эффективных температур достигла порога цветения липы (до 1000 кг/га) — источник взятка подтвержден; в пик липа дает сильной семье 10–15 кг за день.',

  'demo.finding.f2.title': 'Обработку от клеща на взятке — не проводить',
  'demo.finding.f2.summary':
    'Весы показывают товарный привес: любые акарициды сейчас испортят мед. Заклещенность 1,4 % — время подождать.',
  'demo.finding.f2.urgencyNote': 'Держать паузу',
  'demo.finding.f2.probability': 'Риск порчи товарного меда — высокий',
  'demo.finding.f2.risk':
    'Если обработать сейчас: мед с остатками акарицида нельзя продавать, а семья на пике работы получит стресс и потеряет 2–3 дня продуктивности. Отложенная обработка после откачки ничего не теряет: заклещенность дойдет максимум до 1,8 % — по-прежнему ниже порога.',
  'demo.finding.f2.action': 'Отметить: обработка отложена до откачки меда',
  'demo.evidence.f2.0':
    'Весы: +480 г/сут — идет набор товарного меда, любые обработки амитразом оставят след в продукте.',
  'demo.evidence.f2.1': 'Камера: 1 клещ на спинках за смену — заклещенность 1,4 %, ниже порога риска 2 %.',
  'demo.evidence.f2.2': 'GDD-календарь: цветение липы только началось — медосбор продлится еще 10–14 дней.',

  'demo.finding.f3.title': 'Свежий нектар: следить за влажностью',
  'demo.finding.f3.summary': 'Влажность 50 % — верхняя граница нормы (40–50 %): семья осушает нектар. Нужна вентиляция, чтобы мед не начал бродить.',
  'demo.finding.f3.urgencyNote': 'В течение недели',
  'demo.finding.f3.probability': 'Контроль показателя',
  'demo.finding.f3.risk':
    'При затяжных дождях испарение остановится: незрелый мед с водой выше 19–20 % начинает бродить и портится прямо в сотах. Семья потеряет часть товарного меда.',
  'demo.finding.f3.action': 'Приоткрыть леток / усилить вентиляцию',
  'demo.evidence.f3.0': 'Гигрометр: 50 % — верхняя граница нормы 40–50 % для расплодной части; свежий нектар в магазинах требует активной сушки.',
  'demo.evidence.f3.1': 'Акустика 265 Гц — «рабочая» частота вентилирования: семья уже сушит нектар в полный силы.',
  'demo.evidence.f3.2': 'CO₂ 780 ppm — усиленное дыхание и испарение, леток при этом свободен.',

  'demo.finding.f4.title': 'Утренний сброс −1,4 кг — это фуражиры, не потеря',
  'demo.finding.f4.summary':
    'Вес падает утром и восстанавливается к вечеру с прибылью — классическая кривая вылета за взятком.',
  'demo.finding.f4.urgencyNote': 'Наблюдать',
  'demo.finding.f4.probability': 'Ложных срабатываний нет',
  'demo.finding.f4.risk':
    'Риск отсутствует: это нормальная кривая дня. Фильтр «порог тишины ±150 г» уже отсекает мелкие колебания от ветра и капель дождя, поэтому ложных тревог не будет.',
  'demo.finding.f4.action': 'Отметить: сброс веса подтвержден как норма',
  'demo.evidence.f4.0':
    'Весы: с 6:40 до 8:20 сброс −1,4 кг (вылет ~1400 фуражиров), к 20:00 вес выше утреннего на +0,48 кг.',
  'demo.evidence.f4.1': 'Камера: пик вылета 08:00–11:00 — 68 пч/мин, зеркально совпадает с провалом веса.',
  'demo.evidence.f4.2': 'Погода сухая, ветер до 3 м/с — сброс не связан с осадками или обрывом птицами.',

  // ── Предписания: сценарий «Вспышка заклещенности» ──
  'demo.finding.v1.title': 'Критическая заклещенность 3,6 % — высокий риск вируса деформации крыла',
  'demo.finding.v1.summary':
    '3,6 % — выше порога 3 %. Без обработки семья заразится вирусом деформации крыла и ослабнет к зимовке.',
  'demo.finding.v1.urgencyNote': 'Действовать сейчас',
  'demo.finding.v1.probability': 'Вероятность вредоносной нагрузки — 94 %',
  'demo.finding.v1.risk':
    'Через 14 дней заклещенность превысит 5 %: вирус деформации крыла (DWV) переходит в расплод — крылья молодых пчел становятся «стеклышками», семья теряет 30–50 % силы за 2–3 месяца и уйдет в зимовку ослабленной. При 5 % и выше зимовка чаще всего гибельная.',
  'demo.finding.v1.action': 'Провести био-обработку щавелевой кислотой',
  'demo.evidence.v1.0':
    'Камера на летке: 7 пчел с клещами на спинках за смену — при трафике 31 пч/мин это экстраполяция в 3,4–3,7 % заклещенности.',
  'demo.evidence.v1.1':
    'График заклещенности: рост три недели подряд (+0,9 %/нед), прогноз через 14 дней — 5,2 %. Трихлорметазид-обработка в июне эффекта не дала (дип не выражен).',
  'demo.evidence.v1.2':
    'Кросс-проверка: у соседних ульев №1 и №2 показатель 0,8–1,4 % — источник заражения локальный, это именно улей №3, а не пасека целиком.',
  'demo.evidence.v1.3':
    'Камера: у летка замечены 2 пчелы с деформированными крыльями — первые носители DWV уже появились.',

  'demo.finding.v2.title': 'Проверить расплод на вирус деформации крыла (DWV)',
  'demo.finding.v2.summary':
    'Пчелы с «стеклышками» крыльев у летка — вирус уже в семье. Нужен визуальный осмотр рамок с расплодом.',
  'demo.finding.v2.urgencyNote': 'Осмотреть сегодня',
  'demo.finding.v2.probability': 'Вероятность DWV — 68 %',
  'demo.finding.v2.risk':
    'Через 7–10 дней вирус накроет весь расплод: выход молодого поколения с дефектными крыльями, семья не нарастит пчелу к зимовке. Изолировать матку и лечить нужно до середины цикла расплода.',
  'demo.finding.v2.action': 'Осмотреть расплод и приложить фото к отчету',
  'demo.evidence.v2.0':
    'Камера: 2 пчелы с деформированными крыльями за день у летка — больные первыми теряют способность к полету.',
  'demo.evidence.v2.1':
    'Заклещенность 3,6 %: клещ — основной переносчик DWV, при показателе выше 3 % вирус проявляется почти всегда.',
  'demo.evidence.v2.2': 'Трафик 31 пч/мин (−30 % к пасеке) — часть молодых пчел уже не вылетает на работу.',

  'demo.finding.v3.title': 'Слабый трафик на летке — семья теряет темп',
  'demo.finding.v3.summary':
    '31 пч/мин против 45 в среднем по пасеке: клещ ослабляет лётных пчел, привес падает.',
  'demo.finding.v3.urgencyNote': 'В течение недели',
  'demo.finding.v3.probability': 'Связь с заклещенностью — 71 %',
  'demo.finding.v3.risk':
    'Через 3–14 дней разрыв по привесу увеличится: семья соберет на 30–40 % меньше меда до конца сезона, а ослабленные пчелы хуже зимуют.',
  'demo.finding.v3.action': 'Отметить: усиленный контроль трафика на 7 дней',
  'demo.evidence.v3.0':
    'Камера: 31 пч/мин — на 30 % ниже среднего по пасеке при одинаковой погоде для всех ульев.',
  'demo.evidence.v3.1':
    'Весы: привес всего +0,12 кг/сут против +0,17 кг у улья №1 — разница примерно равна потере лётных пчел.',
  'demo.evidence.v3.2': 'Погода для всех ульев одна — фактор погоды исключает причину падения лёта.',

  'demo.finding.v4.title': 'Обработка щавелевой кислотой не навредит взятку',
  'demo.finding.v4.summary':
    'Привес улья скромный (+120 г/сут), товарного потока нет — щавелевая кислота безопасна прямо сейчас.',
  'demo.finding.v4.urgencyNote': 'Запланировать',
  'demo.finding.v4.probability': 'Совместимость с взятком — подтверждена',
  'demo.finding.v4.risk':
    'Затягивание обработки опаснее самого лечения: каждые 7 дней промедления добавляют ~0,9 % заклещенности и повышают риск DWV у зимующих пчел.',
  'demo.finding.v4.action': 'Запланировать обработку на завтра 7:00',
  'demo.evidence.v4.0':
    'Весы: +0,12 кг/сут — ниже порога тишины товарного набора, магазинного меда в сотах прибавляется медленно.',
  'demo.evidence.v4.1':
    'GDD-календарь: основной взяток (липа) семья почти не использует из-за слабого лёта — потери от обработки минимальны.',
  'demo.evidence.v4.2':
    'Щавелевая кислота — био-метод: допустима при слабом взятке, не оставляет следов в товарном меде (в отличие от амитраза).',

  // ── Предписания: сценарий «Предроевое состояние» ──
  'demo.finding.s1.title': 'Пение маток — рой выйдет через 3–5 дней',
  'demo.finding.s1.summary':
    'Акустика зафиксировала 390 Гц, леток в «бороде», вылет упал на 40 %. Семья готова к делению.',
  'demo.finding.s1.urgencyNote': 'Действовать сейчас',
  'demo.finding.s1.probability': 'Вероятность выхода роя — 85 %',
  'demo.finding.s1.risk':
    'Через 3–5 дней с первым хорошим днем рой улетит: семья потеряет до 40 % массы и единственного рабочего потока на 2–3 недели, улей №4 соберет вдвое меньше меда. Поймать вышедший рой удается не всегда.',
  'demo.finding.s1.action': 'Осмотреть маточники',
  'demo.evidence.s1.0':
    'Акустика: 390 Гц — «пение» маток (маточники зреют, молодые матки перекликаются). Нормальный гул семьи — 215 Гц.',
  'demo.evidence.s1.1':
    'Камера: вылет снижен на 40 % и образовалась «борода» из пчел на летке — пчелы-«грелки» вышли из улья из-за духоты.',
  'demo.evidence.s1.2': 'CO₂ вырос до 1450 ppm из-за скученности (норма до 800) — улей переполнен.',
  'demo.evidence.s1.3':
    'Термодатчик: расплодная часть стабильна — 35,0 °C, но в зоне маточников (стройка сот) пчелы подняли температуру до 41 °C — семья греет большой объем свежей стройки.',

  'demo.finding.s2.title': 'Духота в улье — расширить объем и вентиляцию',
  'demo.finding.s2.summary': 'CO₂ 1450 ppm при «бороде» на летке: семье физически не хватает объема и воздуха.',
  'demo.finding.s2.urgencyNote': 'Сегодня',
  'demo.finding.s2.probability': 'Причина духоты — скученность',
  'demo.finding.s2.risk':
    'Через 3–7 дней перегрев расплода (выше 36 °C) вызовет гибель части печатного расплода, а духота ускорит роение — семье комфортнее улететь, чем терпеть.',
  'demo.finding.s2.action': 'Убрать диафрагму / расширить гнездо',
  'demo.evidence.s2.0':
    'CO₂ 1450 ppm — вдвое выше рабочей нормы 600–800 ppm; индекс ЛОС 87 — воздух в улье «тяжелый».',
  'demo.evidence.s2.1': 'Влажность 56 % — выше нормы расплодной части (40–50 %), влага не испаряется: вентиляция не справляется.',
  'demo.evidence.s2.2': '«Борода» на летке — сотни пчел висят снаружи, потому что внутри нет места.',

  'demo.finding.s3.title': 'Сделать искусственное деление (отводок)',
  'demo.finding.s3.summary':
    'Классический прием: отвести роевую энергию на формирование новой семьи, а не потерять её в воздухе.',
  'demo.finding.s3.urgencyNote': 'Сегодня до вечера',
  'demo.finding.s3.probability': 'Эффект проверен практикой',
  'demo.finding.s3.risk':
    'Если дать семье отроиться самой: рой с неплодной маткой может улететь на 5–10 км, старая семья останется без летных пчел на 3 недели. Контролируемый отводок сохраняет обе части семьи.',
  'demo.finding.s3.action': 'Сделать отводок на 3 рамках расплода',
  'demo.evidence.s3.0':
    'Акустика 390 Гц — маточники уже зреют: семья «взяла курс» на роение, отмена его одним расширением не гарантирована.',
  'demo.evidence.s3.1':
    'Весы: привес почти остановился (+0,05 кг/сут) — семья не строит и не собирает, вся энергия в подготовке роя.',
  'demo.evidence.s3.2':
    'Сила семьи высокая (утренний сброс −1,4 кг в обычные дни) — отводок на 3 рамках расплода получится полноценным.',

  'demo.finding.s4.title': 'Оставить 2 лучших маточника, остальные вырезать',
  'demo.finding.s4.summary': '8 маточников — перебор: контроль количества маточников снижает повторное роение.',
  'demo.finding.s4.urgencyNote': 'В течение недели',
  'demo.finding.s4.probability': 'Риск повторного роения без меры — 55 %',
  'demo.finding.s4.risk':
    'Через 7–14 дней после первого роя семья может отроиться повторно с молодой маткой («тихое» роение) — и так до полного ослабления. Контроль маточников — стандартная профилактика.',
  'demo.finding.s4.action': 'Вырезать лишние маточники, оставить 2',
  'demo.evidence.s4.0':
    'Акустика: пение маток слышно уже сейчас — в семье зреет несколько маток одновременно, это классический признак «тихого» повторного роения.',
  'demo.evidence.s4.1': 'Термодатчик: в зоне маточников 41 °C — стройку сот пчелы греют до 40–42 °C; расплодная часть при этом держит постоянные 35,0 °C.',
  'demo.evidence.s4.2': 'Трафик снижен — старая матка уже ограничена в яйцекладке, семья переключилась на размножение.',

  // ── Вечерний отчет (eveningReportLines) ──
  'demo.evening.weight.title': 'Чистый привес нектара',
  'demo.evening.weight.text':
    'После возврата летной пчелы пасека добавила {gain} кг за сутки. Лучший день у улья №{bestHive} — {best} кг (сушка нектара на {hz} Гц). Утренние сбросы фуражиров везде компенсированы вечерним ростом.',
  'demo.evening.varroa.title': 'Статус заклещенности',
  'demo.evening.varroa.item': '№{n} — {p} % ({s})',
  'demo.evening.varroa.itemF': '№{n} — {p} % ({s}, прогноз {f} %)',
  'demo.evening.varroa.text':
    '{list}. Порог критичности 3 %: улей №3 требует обработки щавелевой кислотой — прогноз через 14 дней {f3} %.',
  'demo.evening.bloom.title': 'Цветение по GDD',
  'demo.evening.bloom.text':
    'Сумма эффективных температур {cur} из {need} — {name} зацветет примерно через {d} дн. (порог достигнут на {pct} %). Проверьте объем ульев до старта цветения.',
  'demo.evening.bloomPaused.title': 'Вегетация остановлена',
  'demo.evening.bloomPaused.text':
    'Зимой вегетации нет, прогноз цветения остановлен. Накопленная сумма температур за сезон — {cur} °C·сут. Планируйте кочёвку по полям Минсельхоза в разделе «Кочёвка» — цветение там рассчитано от дат посева.',
  'demo.evening.weather.title': 'Окно лёта на завтра',
  'demo.evening.weather.text':
    'По прогнозу ясно до +24 °C, ветер до 3 м/с, осадки 10 % — лётные условия хорошие. Осмотры лучше провести до 11:00 или после 17:00, чтобы не мешать фуражирам.',
  'demo.evening.done.title': 'Предписания агента',
  'demo.evening.done.text': 'Выполнено предписаний за сутки: {n}. Индексы ульев пересчитаны с учетом выполненных действий.',
  'demo.evening.doneNone.title': 'Предписания агента',
  'demo.evening.doneNone.text':
    'Выполненных предписаний за сутки нет — откройте карточку предписания и нажмите «Выполнить», чтобы отметить действие.',

  // ── Графики, единицы, мелочи ──
  'demo.chart.gainLabel': 'Суточный привес',
  'demo.chart.nightLabel': 'Ночью',
  'demo.chart.weightLabel': 'Вес',
  'demo.unit.kg': 'кг',
  'demo.unit.hz': 'Гц',
  'demo.unit.beesMin': 'пч/мин',
  'demo.unit.km': 'км',
  'demo.hives.all4': '4 улья',
  'demo.agent.discussMsg': 'Обсудим предписание по улью №{n}: {title}',
}

const EN: Dict = {
  // ── Pesticide banner & GDD facts ──
  'dash.pesticide.text':
    'On July 20 the rapeseed field “Zarechnoye” will be sprayed with the insecticide “Karate Zeon” (lambda-cyhalothrin — hazard class I for bees). The field is 2.4 km away, wind blowing towards the apiary.',
  'dash.pesticide.desc':
    'The pyrethroid “Karate Zeon” is highly hazardous to bees (class I): the regulations allow spraying in the evening after sunset with wind no stronger than 1–2 m/s. Under the pesticides law, beekeepers are notified 10–5 days in advance, and all apiaries within a 7 km radius must receive the notice.',
  'dash.pesticide.step1':
    'Clarify the treatment window: pyrethroids are applied at +10…+20 °C, usually in the evening after sunset with wind up to 1–2 m/s — be done before the foragers fly out.',
  'dash.pesticide.step2':
    'Option “relocation”: move the apiary 5–7 km from the “Zarechnoye” field — beyond the bees’ protective flight zone (the Migration section will build the plan).',
  'dash.pesticide.step4':
    'After the treatment: monitor bee arrivals; in case of mass die-off, collect samples and notify the district authorities. Precedent: Bashkiria, 2019 — 40–45 thousand bees died after a rapeseed treatment.',
  'dash.gdd.note.acacia': 'first strong honey flow',
  'dash.gdd.note.sunflower': '13–57 kg/ha, gross yield up to 60 kg',
  'dash.gdd.note.linden': 'up to 800–1000 kg/ha, a colony takes 10–15 kg per day',
  'dash.gdd.note.buckwheat': '60–360 kg/ha, flow of 3–7 kg per day',

  // ── Crops ──
  'demo.crop.acacia': 'Acacia',
  'demo.crop.sunflower': 'Sunflower',
  'demo.crop.linden': 'Linden',
  'demo.crop.buckwheat': 'Buckwheat',

  // ── Evidence sensor labels ──
  'demo.evidence.sensor.scales': 'Smart scales',
  'demo.evidence.sensor.mic': 'Acoustics',
  'demo.evidence.sensor.cam': 'Entrance camera',
  'demo.evidence.sensor.gas': 'Gas sensor',
  'demo.evidence.sensor.temp': 'Temperature sensor',
  'demo.evidence.sensor.hum': 'Hygrometer',
  'demo.evidence.sensor.gdd': 'GDD calendar',
  'demo.evidence.sensor.weather': 'Weather forecast',
  'demo.evidence.sensor.stats': 'Treatment statistics',

  // ── Basis sensor labels ──
  'demo.basis.scales': 'Scales',
  'demo.basis.mic': 'Acoustics',
  'demo.basis.cam': 'Camera',
  'demo.basis.temp': 'Temp sensor',
  'demo.basis.gdd': 'GDD',
  'demo.basis.stats': 'Treatment stats',
  'demo.basis.weather': 'Weather forecast',
  'demo.basis.hum': 'Hygrometer',
  'demo.basis.gas': 'Gas sensor',

  // ── Air & traffic helpers ──
  'demo.voc.hot': 'Stuffy — the colony lacks space',
  'demo.voc.mid': 'Moderate air load',
  'demo.voc.ok': 'Air is clean',
  'demo.traffic.high': 'Intense flight',
  'demo.traffic.active': 'Active flight',
  'demo.traffic.weak': 'Flight weakened',
  'demo.traffic.low': 'Flight sharply reduced',

  // ── Hive fields ──
  'demo.hive.0.label': 'Whole apiary',
  'demo.hive.0.scenarioHint': 'Apiary-wide averages · 1 hive with critical varroa load, 1 pre-swarming',
  'demo.hive.0.entranceLabel': 'Flight active across the apiary',
  'demo.hive.0.acousticLabel': 'Average apiary hum — working the flow',
  'demo.hive.0.corps': '4 hives · 12 brood boxes · 1 super',
  'demo.hive.1.label': 'Hive No.1',
  'demo.hive.1.scenarioHint': 'Index 9.2 · varroa 0.8% · stable honey flow',
  'demo.hive.1.entranceLabel': 'Active flight',
  'demo.hive.1.acousticLabel': 'Even colony hum — normal',
  'demo.hive.1.corps': '3 brood boxes (dadan)',
  'demo.hive.1.queenBreed': 'Carnica',
  'demo.hive.1.queenMark': 'blue mark',
  'demo.hive.2.label': 'Hive No.2',
  'demo.hive.2.scenarioHint': 'Index 8.8 · gain +480 g/day · humidity 50% (drying nectar)',
  'demo.hive.2.entranceLabel': 'Intense flight — peak flow',
  'demo.hive.2.acousticLabel': 'Ventilation: drying fresh nectar',
  'demo.hive.2.corps': '3 brood boxes + 1 super (dadan)',
  'demo.hive.2.queenBreed': 'Buckfast',
  'demo.hive.2.queenMark': 'green mark',
  'demo.hive.3.label': 'Hive No.3',
  'demo.hive.3.scenarioHint': 'Index 4.8 · varroa 3.6% · deformed wing virus risk',
  'demo.hive.3.entranceLabel': 'Flight weakened (−30% vs apiary)',
  'demo.hive.3.acousticLabel': 'Uneven hum — the colony is restless',
  'demo.hive.3.corps': '3 brood boxes (dadan)',
  'demo.hive.3.queenBreed': 'Carnica',
  'demo.hive.3.queenMark': 'yellow mark',
  'demo.hive.4.label': 'Hive No.4',
  'demo.hive.4.scenarioHint': 'Index 5.5 · queen cells 41 °C · queen piping · “beard” at the entrance',
  'demo.hive.4.entranceLabel': 'Bees clustered in a “beard” — swarming risk',
  'demo.hive.4.acousticLabel': 'Queen piping: swarm leaves in 3–5 days',
  'demo.hive.4.corps': '3 brood boxes (dadan)',
  'demo.hive.4.queenBreed': 'Local Middle Russian',
  'demo.hive.4.queenMark': 'unmarked',

  // ── Findings: scenario “Norm” ──
  'demo.finding.n1.title': 'Colony developing as normal',
  'demo.finding.n1.summary': 'All six sensor groups are normal — keep observing, no intervention needed.',
  'demo.finding.n1.urgencyNote': 'Observe',
  'demo.finding.n1.probability': 'No deviations detected',
  'demo.finding.n1.risk':
    'No risk: if current readings hold, the colony will keep building strength without losses. The next checkpoint is the routine inspection in 7 days.',
  'demo.finding.n1.action': 'Mark: routine inspection done',
  'demo.evidence.n1.0':
    'Scales: smooth gain of +0.16…+0.19 kg/day for 5 days in a row — no dips or spikes (the ±150 g quiet threshold filters out wind and rain).',
  'demo.evidence.n1.1':
    'Temp sensor: 35.0 °C in the brood area — the temperature is constant, as it should be (norm). The periphery is 1–2 °C lower, the food section ≈ 30 °C.',
  'demo.evidence.n1.2':
    'Acoustics: even hum at 215 Hz — the colony is calm, no ventilation and no queen piping.',
  'demo.evidence.n1.3':
    'Entrance camera: 0 mites on bee backs per shift, traffic 42 bees/min — flight activity is fully normal.',

  'demo.finding.n2.title': 'Time to add a honey super',
  'demo.finding.n2.summary': 'Fewer than two free combs remain — the colony will soon hit the ceiling of space.',
  'demo.finding.n2.urgencyNote': 'Within a week',
  'demo.finding.n2.probability': 'Probability of comb shortage — 82%',
  'demo.finding.n2.risk':
    'In 5–8 days all combs will be taken by honey and brood: the colony will restrict the queen’s egg-laying, the honey-flow pace will drop by 20–30%, and the crowding will push toward swarming.',
  'demo.finding.n2.action': 'Expand the brood nest / add supers',
  'demo.evidence.n2.0':
    'Scales: steady +0.17 kg/day — the colony brings nectar every day and has filled almost the entire top box with honey.',
  'demo.evidence.n2.1':
    'Camera: 6 of 10 returning bees carry pollen loads — a strong flow will continue; extra space will be needed in as little as 3–4 days.',
  'demo.evidence.n2.2':
    'GDD calendar: the temperature sum has reached the acacia bloom threshold — the nectar inflow will intensify.',

  'demo.finding.n3.title': 'Varroa load is normal — no treatment needed',
  'demo.finding.n3.summary': '0.8% — half the risk threshold. Chemicals now would only disturb a colony on the flow.',
  'demo.finding.n3.urgencyNote': 'Observe',
  'demo.finding.n3.probability': 'Forecast +14 days: 0.9% — still normal',
  'demo.finding.n3.risk':
    'Without new treatments the load will reach ~1.3% by September — it stays in the safe zone. The risk of deformed wing virus is minimal.',
  'demo.finding.n3.action': 'Schedule a control count in 14 days',
  'demo.evidence.n3.0':
    'Camera: 0 mites on bee backs during the observation shift (up to 3 per day would be alarming).',
  'demo.evidence.n3.1':
    'Varroa chart: after the June oxalic-acid treatment the level has held at 0.7–0.8% for 12 days — the treatment worked.',
  'demo.evidence.n3.2':
    'Scales show a steady gain — the colony is strong, no mite-related weakening.',

  'demo.finding.n4.title': 'Tomorrow is an excellent flight window',
  'demo.finding.n4.summary':
    'Up to +24 °C, wind up to 3 m/s, 10% precipitation — maximum forager flight; better not to plan inspections.',
  'demo.finding.n4.urgencyNote': 'Use the flight window',
  'demo.finding.n4.probability': 'Per the 10-day forecast',
  'demo.finding.n4.risk':
    'Missing the window is not dangerous, but one day of flow is lost: at +180 g/day that is ~0.2 kg of honey from a single hive.',
  'demo.finding.n4.action': 'Mark: inspection postponed to the day after tomorrow',
  'demo.evidence.n4.0':
    'Forecast: tomorrow clear up to +24 °C, wind 3 m/s, 10% chance of precipitation — flight conditions are “good”.',
  'demo.evidence.n4.1':
    'Scales: morning drop of −1.1 kg and quick recovery by evening — the foragers work a full day.',

  // ── Findings: scenario “Active honey flow” ──
  'demo.finding.f1.title': 'Active honey flow — the colony works the linden',
  'demo.finding.f1.summary':
    'Gain +480 g/day; the colony has switched to nectar-drying mode. Time to give space for fresh honey.',
  'demo.finding.f1.urgencyNote': 'Today',
  'demo.finding.f1.probability': 'Probability of a sustained flow — 91%',
  'demo.finding.f1.risk':
    'In 3–5 days at this pace the combs will fill up: without extra space the colony will restrict the queen, and the nectar will start losing moisture slowly — a risk of fermentation when the weather changes.',
  'demo.finding.f1.action': 'Expand the brood nest / add supers',
  'demo.evidence.f1.0':
    'Scales: gain of +460…+480 g/day for 3 days in a row — well above the ±150 g quiet threshold; it is not wind or moisture.',
  'demo.evidence.f1.1':
    'Hygrometer: brood-area humidity at the upper norm limit — 50% (norm 40–50%) in dry outside weather (52%) — the colony has flooded the combs with fresh nectar and switched to drying.',
  'demo.evidence.f1.2':
    'Acoustics: the hum has shifted to 265 Hz — the colony has turned on ventilation to dry the nectar.',
  'demo.evidence.f1.3':
    'GDD calendar: the effective temperature sum has reached the linden bloom threshold (up to 1000 kg/ha) — the flow source is confirmed; at peak, linden gives a strong colony 10–15 kg in a day.',

  'demo.finding.f2.title': 'No mite treatment during the flow',
  'demo.finding.f2.summary':
    'Scales show a marketable gain: any acaricide now would spoil the honey. Load is 1.4% — time to wait.',
  'demo.finding.f2.urgencyNote': 'Hold the pause',
  'demo.finding.f2.probability': 'Risk of spoiling marketable honey — high',
  'demo.finding.f2.risk':
    'Treating now: honey with acaricide residues cannot be sold, and a colony at peak workload will be stressed and lose 2–3 days of productivity. A treatment postponed until after extraction loses nothing: the load will reach at most 1.8% — still below the threshold.',
  'demo.finding.f2.action': 'Mark: treatment postponed until honey extraction',
  'demo.evidence.f2.0':
    'Scales: +480 g/day — marketable honey is building up; any amitraz treatment would leave residue in the product.',
  'demo.evidence.f2.1':
    'Camera: 1 mite on bee backs per shift — load 1.4%, below the 2% risk threshold.',
  'demo.evidence.f2.2':
    'GDD calendar: the linden bloom has only just begun — the flow will last another 10–14 days.',

  'demo.finding.f3.title': 'Fresh nectar: watch the humidity',
  'demo.finding.f3.summary':
    '50% humidity — the upper norm limit (40–50%): the colony is drying nectar. Ventilation is needed so the honey does not start to ferment.',
  'demo.finding.f3.urgencyNote': 'Within a week',
  'demo.finding.f3.probability': 'Monitoring the indicator',
  'demo.finding.f3.risk':
    'In prolonged rains evaporation will stall: unripe honey with water above 19–20% starts to ferment and spoils right in the combs. The colony will lose part of its marketable honey.',
  'demo.finding.f3.action': 'Open the entrance slightly / boost ventilation',
  'demo.evidence.f3.0':
    'Hygrometer: 50% — the upper limit of the 40–50% brood-area norm; fresh nectar in the supers needs active drying.',
  'demo.evidence.f3.1':
    'Acoustics at 265 Hz — the “working” ventilation frequency: the colony is already drying nectar at full power.',
  'demo.evidence.f3.2':
    'CO₂ 780 ppm — intensified respiration and evaporation, while the entrance remains clear.',

  'demo.finding.f4.title': 'Morning drop of −1.4 kg — foragers, not a loss',
  'demo.finding.f4.summary':
    'Weight drops in the morning and recovers by evening with a surplus — the classic foraging-flight curve.',
  'demo.finding.f4.urgencyNote': 'Observe',
  'demo.finding.f4.probability': 'No false alarms',
  'demo.finding.f4.risk':
    'No risk: this is a normal daily curve. The “±150 g quiet threshold” filter already cuts out small wind and rain-drop fluctuations, so there will be no false alarms.',
  'demo.finding.f4.action': 'Mark: the weight drop is confirmed as normal',
  'demo.evidence.f4.0':
    'Scales: from 6:40 to 8:20 a drop of −1.4 kg (~1400 foragers out), by 20:00 the weight is +0.48 kg above the morning level.',
  'demo.evidence.f4.1':
    'Camera: flight peak 08:00–11:00 — 68 bees/min, mirroring the weight dip exactly.',
  'demo.evidence.f4.2':
    'Weather is dry, wind up to 3 m/s — the drop is unrelated to rain or birds robbing the hive.',

  // ── Findings: scenario “Varroa outbreak” ──
  'demo.finding.v1.title': 'Critical varroa load 3.6% — high risk of deformed wing virus',
  'demo.finding.v1.summary':
    '3.6% — above the 3% threshold. Without treatment the colony will contract deformed wing virus and enter winter weakened.',
  'demo.finding.v1.urgencyNote': 'Act now',
  'demo.finding.v1.probability': 'Probability of harmful load — 94%',
  'demo.finding.v1.risk':
    'In 14 days the load will exceed 5%: deformed wing virus (DWV) spreads into the brood — young bees’ wings become “little panes of glass”, the colony loses 30–50% of its strength over 2–3 months and goes into winter weakened. At 5% and above, wintering is most often fatal.',
  'demo.finding.v1.action': 'Carry out an oxalic-acid bio-treatment',
  'demo.evidence.v1.0':
    'Entrance camera: 7 bees with mites on their backs per shift — at a traffic of 31 bees/min this extrapolates to 3.4–3.7% infestation.',
  'demo.evidence.v1.1':
    'Varroa chart: growth three weeks in a row (+0.9%/week), 14-day forecast 5.2%. The June trichlormetazide treatment had no effect (no visible dip).',
  'demo.evidence.v1.2':
    'Cross-check: neighboring hives No.1 and No.2 show 0.8–1.4% — the infestation source is local: it is hive No.3 specifically, not the whole apiary.',
  'demo.evidence.v1.3':
    'Camera: 2 bees with deformed wings spotted at the entrance — the first DWV carriers have already appeared.',

  'demo.finding.v2.title': 'Check the brood for deformed wing virus (DWV)',
  'demo.finding.v2.summary':
    'Bees with “glassy” wings at the entrance — the virus is already in the colony. A visual inspection of brood frames is needed.',
  'demo.finding.v2.urgencyNote': 'Inspect today',
  'demo.finding.v2.probability': 'Probability of DWV — 68%',
  'demo.finding.v2.risk':
    'In 7–10 days the virus will cover the entire brood: a young generation emerging with defective wings, and the colony will not build up bees for winter. The queen must be isolated and treatment done before the middle of the brood cycle.',
  'demo.finding.v2.action': 'Inspect the brood and attach a photo to the report',
  'demo.evidence.v2.0':
    'Camera: 2 bees with deformed wings per day at the entrance — sick bees lose the ability to fly first.',
  'demo.evidence.v2.1':
    'Load 3.6%: the mite is the main DWV vector; above 3% the virus almost always manifests.',
  'demo.evidence.v2.2':
    'Traffic 31 bees/min (−30% vs the apiary) — some young bees no longer fly out to work.',

  'demo.finding.v3.title': 'Weak entrance traffic — the colony is losing pace',
  'demo.finding.v3.summary':
    '31 bees/min vs 45 apiary average: the mite weakens flying bees and the gain is falling.',
  'demo.finding.v3.urgencyNote': 'Within a week',
  'demo.finding.v3.probability': 'Link with varroa load — 71%',
  'demo.finding.v3.risk':
    'In 3–14 days the gain gap will widen: the colony will harvest 30–40% less honey by the end of the season, and weakened bees winter poorly.',
  'demo.finding.v3.action': 'Mark: enhanced traffic monitoring for 7 days',
  'demo.evidence.v3.0':
    'Camera: 31 bees/min — 30% below the apiary average with identical weather for all hives.',
  'demo.evidence.v3.1':
    'Scales: gain of only +0.12 kg/day vs +0.17 kg in hive No.1 — the difference roughly equals the loss of flying bees.',
  'demo.evidence.v3.2':
    'All hives share the same weather — the weather factor rules out a cause for the flight decline.',

  'demo.finding.v4.title': 'Oxalic-acid treatment will not harm the flow',
  'demo.finding.v4.summary':
    'The hive’s gain is modest (+120 g/day) with no marketable flow — oxalic acid is safe right now.',
  'demo.finding.v4.urgencyNote': 'Schedule',
  'demo.finding.v4.probability': 'Compatibility with the flow — confirmed',
  'demo.finding.v4.risk':
    'Delaying treatment is more dangerous than the treatment itself: every 7 days of hesitation add ~0.9% of infestation and raise the DWV risk for winter bees.',
  'demo.finding.v4.action': 'Schedule the treatment for tomorrow at 7:00',
  'demo.evidence.v4.0':
    'Scales: +0.12 kg/day — below the quiet threshold of marketable buildup; honey in the supers accumulates slowly.',
  'demo.evidence.v4.1':
    'GDD calendar: the colony barely uses the main flow (linden) due to weak flight — treatment losses are minimal.',
  'demo.evidence.v4.2':
    'Oxalic acid is a bio-method: allowed during a weak flow and leaves no residue in marketable honey (unlike amitraz).',

  // ── Findings: scenario “Pre-swarming” ──
  'demo.finding.s1.title': 'Queen piping — the swarm will leave in 3–5 days',
  'demo.finding.s1.summary':
    'Acoustics recorded 390 Hz, the entrance shows a “beard”, flight is down 40%. The colony is ready to divide.',
  'demo.finding.s1.urgencyNote': 'Act now',
  'demo.finding.s1.probability': 'Probability of swarm departure — 85%',
  'demo.finding.s1.risk':
    'In 3–5 days, with the first good day, the swarm will fly away: the colony will lose up to 40% of its mass and its only working flow for 2–3 weeks; hive No.4 will harvest half the honey. A departed swarm cannot always be caught.',
  'demo.finding.s1.action': 'Inspect the queen cells',
  'demo.evidence.s1.0':
    'Acoustics: 390 Hz — queen “piping” (queen cells ripening, young queens calling to each other). A normal colony hum is 215 Hz.',
  'demo.evidence.s1.1':
    'Camera: flight down 40% and a “beard” of bees formed at the entrance — the “heater” bees left the hive because of the stuffiness.',
  'demo.evidence.s1.2':
    'CO₂ rose to 1450 ppm due to crowding (norm up to 800) — the hive is overcrowded.',
  'demo.evidence.s1.3':
    'Temp sensor: the brood area is stable at 35.0 °C, but in the queen-cell zone (comb building) the bees have raised the temperature to 41 °C — the colony is warming a large volume of fresh comb.',

  'demo.finding.s2.title': 'Stuffiness in the hive — expand space and ventilation',
  'demo.finding.s2.summary':
    'CO₂ 1450 ppm with a “beard” at the entrance: the colony physically lacks space and air.',
  'demo.finding.s2.urgencyNote': 'Today',
  'demo.finding.s2.probability': 'Cause of stuffiness — crowding',
  'demo.finding.s2.risk':
    'In 3–7 days overheating of the brood (above 36 °C) will kill part of the capped brood, and the stuffiness will accelerate swarming — for the colony it is easier to fly away than to endure.',
  'demo.finding.s2.action': 'Remove the division board / expand the nest',
  'demo.evidence.s2.0':
    'CO₂ 1450 ppm — twice the working norm of 600–800 ppm; VOC index 87 — the air in the hive is “heavy”.',
  'demo.evidence.s2.1':
    'Humidity 56% — above the brood-area norm (40–50%); moisture is not evaporating: ventilation cannot cope.',
  'demo.evidence.s2.2':
    'A “beard” at the entrance — hundreds of bees hang outside because there is no room inside.',

  'demo.finding.s3.title': 'Make an artificial division (split)',
  'demo.finding.s3.summary':
    'The classic technique: divert the swarming energy into forming a new colony instead of losing it in the air.',
  'demo.finding.s3.urgencyNote': 'Today, before evening',
  'demo.finding.s3.probability': 'The effect is field-proven',
  'demo.finding.s3.risk':
    'If the colony is left to swarm on its own: a swarm with an unmated queen can fly 5–10 km away, and the old colony will be without flying bees for 3 weeks. A controlled split preserves both parts of the colony.',
  'demo.finding.s3.action': 'Make a split on 3 brood frames',
  'demo.evidence.s3.0':
    'Acoustics 390 Hz — the queen cells are already ripening: the colony is “set on course” for swarming; canceling it with a single expansion is not guaranteed.',
  'demo.evidence.s3.1':
    'Scales: the gain has nearly stopped (+0.05 kg/day) — the colony is neither building nor foraging; all its energy goes into preparing the swarm.',
  'demo.evidence.s3.2':
    'Colony strength is high (morning drop of −1.4 kg on ordinary days) — a split on 3 brood frames will be fully viable.',

  'demo.finding.s4.title': 'Keep the 2 best queen cells, cut the rest',
  'demo.finding.s4.summary':
    '8 queen cells is too many: controlling their number reduces secondary swarming.',
  'demo.finding.s4.urgencyNote': 'Within a week',
  'demo.finding.s4.probability': 'Risk of re-swarming without action — 55%',
  'demo.finding.s4.risk':
    'In 7–14 days after the first swarm the colony may swarm again with a young queen (“silent” swarming) — and so on until complete exhaustion. Queen-cell control is standard prevention.',
  'demo.finding.s4.action': 'Cut the excess queen cells, keep 2',
  'demo.evidence.s4.0':
    'Acoustics: queen piping is audible already — several queens are ripening at once in the colony, the classic sign of “silent” secondary swarming.',
  'demo.evidence.s4.1':
    'Temp sensor: 41 °C in the queen-cell zone — bees warm the comb building to 40–42 °C, while the brood area holds a constant 35.0 °C.',
  'demo.evidence.s4.2':
    'Traffic is reduced — the old queen is already restricted in egg-laying; the colony has switched to reproduction.',

  // ── Evening report ──
  'demo.evening.weight.title': 'Net nectar gain',
  'demo.evening.weight.text':
    'After the foragers returned, the apiary added {gain} kg in a day. The best day was hive No.{bestHive} — {best} kg (drying nectar at {hz} Hz). Morning drops of foragers were everywhere offset by evening growth.',
  'demo.evening.varroa.title': 'Varroa load status',
  'demo.evening.varroa.item': 'No.{n} — {p}% ({s})',
  'demo.evening.varroa.itemF': 'No.{n} — {p}% ({s}, forecast {f}%)',
  'demo.evening.varroa.text':
    '{list}. The critical threshold is 3%: hive No.3 needs an oxalic-acid treatment — the 14-day forecast is {f3}%.',
  'demo.evening.bloom.title': 'Bloom by GDD',
  'demo.evening.bloom.text':
    'Effective temperature sum {cur} of {need} — {name} will bloom in about {d} days (threshold reached at {pct}%). Check hive volume before the bloom starts.',
  'demo.evening.bloomPaused.title': 'Vegetation paused',
  'demo.evening.bloomPaused.text':
    'No vegetation in winter, the bloom forecast is paused. Season total: {cur} °C·day. Plan next season via the Minselkhoz fields in the Migration tab — bloom is computed from sowing dates.',
  'demo.evening.weather.title': 'Flight window for tomorrow',
  'demo.evening.weather.text':
    'Forecast: clear up to +24 °C, wind up to 3 m/s, 10% precipitation — flight conditions are good. Better to inspect before 11:00 or after 17:00 to avoid disturbing the foragers.',
  'demo.evening.done.title': 'Agent prescriptions',
  'demo.evening.done.text':
    'Prescriptions completed in the last 24 hours: {n}. Hive indexes were recalculated taking the completed actions into account.',
  'demo.evening.doneNone.title': 'Agent prescriptions',
  'demo.evening.doneNone.text':
    'No prescriptions completed in the last 24 hours — open a prescription card and press “Complete” to mark an action.',

  // ── Charts, units, misc ──
  'demo.chart.gainLabel': 'Daily gain',
  'demo.chart.nightLabel': 'At night',
  'demo.chart.weightLabel': 'Weight',
  'demo.unit.kg': 'kg',
  'demo.unit.hz': 'Hz',
  'demo.unit.beesMin': 'bees/min',
  'demo.unit.km': 'km',
  'demo.hives.all4': '4 hives',
  'demo.agent.discussMsg': 'Let’s discuss the prescription for hive No.{n}: {title}',
}

const FR: Dict = {
  // ── Bandeau pesticide & faits GDD ──
  'dash.pesticide.text':
    'Le 20 juillet, le champ de colza « Zarechnoye » sera traité avec l’insecticide « Karaté Zeon » (lambda-cyhalothrine — classe de danger I pour les abeilles). Champ à 2,4 km, vent en direction du rucher.',
  'dash.pesticide.desc':
    'Le pyréthrinoïde « Karaté Zeon » est très dangereux pour les abeilles (classe I) : le règlement autorise le traitement le soir après le coucher du soleil avec un vent ne dépassant pas 1–2 m/s. Selon la loi sur l’utilisation des pesticides, les apiculteurs sont avertis 10 à 5 jours avant, et tous les ruchers dans un rayon de 7 km doivent recevoir la notification.',
  'dash.pesticide.step1':
    'Précisez la fenêtre de traitement : les pyréthrinoïdes s’appliquent à +10…+20 °C, généralement le soir après le coucher du soleil avec un vent jusqu’à 1–2 m/s — terminez avant le départ des butineuses.',
  'dash.pesticide.step2':
    'Option « déménagement » : déplacer le rucher à 5–7 km du champ « Zarechnoye » — au-delà de la zone de protection de vol des abeilles (la section « Transhumance » établira le plan).',
  'dash.pesticide.step4':
    'Après le traitement : surveiller le retour des abeilles ; en cas de mortalité massive, prélever des échantillons et informer l’administration du district. Précédent : Bachkirie, 2019 — 40–45 mille abeilles sont mortes après un traitement du colza.',
  'dash.gdd.note.acacia': 'première miellée forte',
  'dash.gdd.note.sunflower': '13–57 kg/ha, récolte brute jusqu’à 60 kg',
  'dash.gdd.note.linden': 'jusqu’à 800–1000 kg/ha, une colonie prend 10–15 kg par jour',
  'dash.gdd.note.buckwheat': '60–360 kg/ha, miellée de 3–7 kg par jour',

  // ── Cultures ──
  'demo.crop.acacia': 'Acacia',
  'demo.crop.sunflower': 'Tournesol',
  'demo.crop.linden': 'Tilleul',
  'demo.crop.buckwheat': 'Sarrasin',

  // ── Libellés des capteurs de preuves ──
  'demo.evidence.sensor.scales': 'Balances connectées',
  'demo.evidence.sensor.mic': 'Acoustique',
  'demo.evidence.sensor.cam': 'Caméra à l’entrée',
  'demo.evidence.sensor.gas': 'Capteur de gaz',
  'demo.evidence.sensor.temp': 'Capteur de température',
  'demo.evidence.sensor.hum': 'Hygromètre',
  'demo.evidence.sensor.gdd': 'Calendrier GDD',
  'demo.evidence.sensor.weather': 'Prévisions météo',
  'demo.evidence.sensor.stats': 'Statistiques de traitement',

  // ── Libellés des capteurs (basis) ──
  'demo.basis.scales': 'Balances',
  'demo.basis.mic': 'Acoustique',
  'demo.basis.cam': 'Caméra',
  'demo.basis.temp': 'Capteur temp.',
  'demo.basis.gdd': 'GDD',
  'demo.basis.stats': 'Stats de traitement',
  'demo.basis.weather': 'Prévisions météo',
  'demo.basis.hum': 'Hygromètre',
  'demo.basis.gas': 'Capteur de gaz',

  // ── Aide air & trafic ──
  'demo.voc.hot': 'Étouffant — la colonie manque de volume',
  'demo.voc.mid': 'Charge d’air modérée',
  'demo.voc.ok': 'Air pur',
  'demo.traffic.high': 'Vol intense',
  'demo.traffic.active': 'Vol actif',
  'demo.traffic.weak': 'Vol affaibli',
  'demo.traffic.low': 'Vol fortement réduit',

  // ── Champs des ruches ──
  'demo.hive.0.label': 'Tout le rucher',
  'demo.hive.0.scenarioHint': 'Moyennes du rucher · 1 ruche à infestation critique, 1 pré-essaimage',
  'demo.hive.0.entranceLabel': 'Vol actif sur tout le rucher',
  'demo.hive.0.acousticLabel': 'Bourdonnement moyen du rucher — travail en miellée',
  'demo.hive.0.corps': '4 ruches · 12 corps · 1 hausse',
  'demo.hive.1.label': 'Ruche n°1',
  'demo.hive.1.scenarioHint': 'Indice 9,2 · infestation 0,8 % · miellée stable',
  'demo.hive.1.entranceLabel': 'Vol actif',
  'demo.hive.1.acousticLabel': 'Bourdonnement régulier de la colonie — normal',
  'demo.hive.1.corps': '3 corps (dadan)',
  'demo.hive.1.queenBreed': 'Carnica',
  'demo.hive.1.queenMark': 'marque bleue',
  'demo.hive.2.label': 'Ruche n°2',
  'demo.hive.2.scenarioHint': 'Indice 8,8 · gain +480 g/jour · humidité 50 % (séchage du nectar)',
  'demo.hive.2.entranceLabel': 'Vol intense — pic de miellée',
  'demo.hive.2.acousticLabel': 'Ventilation : séchage du nectar frais',
  'demo.hive.2.corps': '3 corps + 1 hausse (dadan)',
  'demo.hive.2.queenBreed': 'Buckfast',
  'demo.hive.2.queenMark': 'marque verte',
  'demo.hive.3.label': 'Ruche n°3',
  'demo.hive.3.scenarioHint': 'Indice 4,8 · infestation 3,6 % · risque du virus des ailes déformées',
  'demo.hive.3.entranceLabel': 'Vol affaibli (−30 % vs rucher)',
  'demo.hive.3.acousticLabel': 'Bourdonnement irrégulier — la colonie est agitée',
  'demo.hive.3.corps': '3 corps (dadan)',
  'demo.hive.3.queenBreed': 'Carnica',
  'demo.hive.3.queenMark': 'marque jaune',
  'demo.hive.4.label': 'Ruche n°4',
  'demo.hive.4.scenarioHint': 'Indice 5,5 · cellules royales 41 °C · chant des reines · « barbe » à l’entrée',
  'demo.hive.4.entranceLabel': 'Abeilles agglutinées en « barbe » — risque d’essaimage',
  'demo.hive.4.acousticLabel': 'Chant des reines : sortie de l’essaim dans 3–5 jours',
  'demo.hive.4.corps': '3 corps (dadan)',
  'demo.hive.4.queenBreed': 'Locale (Moyenne-Russe)',
  'demo.hive.4.queenMark': 'sans marque',

  // ── Prescriptions : scénario « Norme » ──
  'demo.finding.n1.title': 'La colonie se développe normalement',
  'demo.finding.n1.summary':
    'Les six groupes de capteurs sont normaux — poursuivez l’observation, aucune intervention requise.',
  'demo.finding.n1.urgencyNote': 'Observer',
  'demo.finding.n1.probability': 'Aucun écart détecté',
  'demo.finding.n1.risk':
    'Aucun risque : si les indicateurs actuels se maintiennent, la colonie continuera à se renforcer sans pertes. Le prochain point de contrôle est l’inspection de routine dans 7 jours.',
  'demo.finding.n1.action': 'Marquer : inspection de routine effectuée',
  'demo.evidence.n1.0':
    'Balances : gain régulier de +0,16…+0,19 kg/jour pendant 5 jours d’affilée — sans creux ni pics (le seuil de silence ±150 g écarte le vent et la pluie).',
  'demo.evidence.n1.1':
    'Capteur de température : 35,0 °C dans la partie à couvain — température constante, comme il se doit (norme). La périphérie est plus basse de 1–2 °C, la partie réservée aux provisions ≈ 30 °C.',
  'demo.evidence.n1.2':
    'Acoustique : bourdonnement régulier à 215 Hz — la colonie est calme, ni ventilation ni chant de reines.',
  'demo.evidence.n1.3':
    'Caméra à l’entrée : 0 varroa sur le dos des abeilles par roulement, trafic de 42 abeilles/min — vol pleinement normal.',

  'demo.finding.n2.title': 'Il est temps d’ajouter une hausse',
  'demo.finding.n2.summary':
    'Moins de deux rayons libres restent — la colonie sera vite à court d’espace.',
  'demo.finding.n2.urgencyNote': 'Dans la semaine',
  'demo.finding.n2.probability': 'Probabilité de manque de rayons — 82 %',
  'demo.finding.n2.risk':
    'Dans 5–8 jours, tous les rayons seront occupés par le miel et le couvain : la colonie limitera la ponte de la reine, le rythme de miellée chutera de 20–30 %, et l’exiguïté poussera à l’essaimage.',
  'demo.finding.n2.action': 'Agrandir le nid / poser des hausses',
  'demo.evidence.n2.0':
    'Balances : +0,17 kg/jour stable — la colonie rapporte du nectar chaque jour et a presque entièrement rempli de miel le corps supérieur.',
  'demo.evidence.n2.1':
    'Caméra : 6 abeilles sur 10 reviennent avec des pelotes de pollen — la forte miellée continuera ; l’espace sera nécessaire d’ici 3–4 jours.',
  'demo.evidence.n2.2':
    'Calendrier GDD : la somme de températures a atteint le seuil de floraison de l’acacia — l’apport de nectar va s’intensifier.',

  'demo.finding.n3.title': 'Infestation normale — aucun traitement requis',
  'demo.finding.n3.summary':
    '0,8 % — deux fois sous le seuil de risque. Un traitement chimique ne ferait que déranger la colonie en miellée.',
  'demo.finding.n3.urgencyNote': 'Observer',
  'demo.finding.n3.probability': 'Prévision +14 jours : 0,9 % — toujours normal',
  'demo.finding.n3.risk':
    'Sans nouveaux traitements, l’infestation atteindra ~1,3 % en septembre — elle reste en zone sûre. Le risque du virus des ailes déformées est minime.',
  'demo.finding.n3.action': 'Planifier un comptage de contrôle dans 14 jours',
  'demo.evidence.n3.0':
    'Caméra : 0 varroa sur le dos des abeilles pendant la période d’observation (jusqu’à 3 par jour serait alarmant).',
  'demo.evidence.n3.1':
    'Graphique d’infestation : après le traitement à l’acide oxalique de juin, le taux se maintient à 0,7–0,8 % depuis 12 jours — le traitement a fonctionné.',
  'demo.evidence.n3.2':
    'Les balances montrent un gain régulier — la colonie est forte, aucun affaiblissement dû au varroa.',

  'demo.finding.n4.title': 'Demain, une excellente fenêtre de vol',
  'demo.finding.n4.summary':
    'Jusqu’à +24 °C, vent jusqu’à 3 m/s, précipitations 10 % — maximum de butinage ; mieux vaut ne pas planifier d’inspections.',
  'demo.finding.n4.urgencyNote': 'Profiter de la fenêtre de vol',
  'demo.finding.n4.probability': 'Selon les prévisions à 10 jours',
  'demo.finding.n4.risk':
    'Manquer la fenêtre n’est pas dangereux, mais une journée de miellée est perdue : à +180 g/jour, cela fait ~0,2 kg de miel pour une seule ruche.',
  'demo.finding.n4.action': 'Marquer : inspection reportée à après-demain',
  'demo.evidence.n4.0':
    'Prévisions : demain ciel clair jusqu’à +24 °C, vent 3 m/s, probabilité de précipitations 10 % — conditions de vol « bonnes ».',
  'demo.evidence.n4.1':
    'Balances : perte matinale de −1,1 kg et récupération rapide d’ici le soir — les butineuses travaillent toute la journée.',

  // ── Prescriptions : scénario « Miellée active » ──
  'demo.finding.f1.title': 'Miellée active — la colonie butine le tilleul',
  'demo.finding.f1.summary':
    'Gain de +480 g/jour ; la colonie est passée en mode séchage du nectar. Il est temps de donner du volume pour le miel frais.',
  'demo.finding.f1.urgencyNote': 'Aujourd’hui',
  'demo.finding.f1.probability': 'Probabilité d’une miellée soutenue — 91 %',
  'demo.finding.f1.risk':
    'Dans 3–5 jours à ce rythme, les rayons se rempliront : sans volume supplémentaire, la colonie limitera la reine, et le nectar perdra lentement son eau — risque de fermentation au changement de temps.',
  'demo.finding.f1.action': 'Agrandir le nid / poser des hausses',
  'demo.evidence.f1.0':
    'Balances : gain de +460…+480 g/jour pendant 3 jours d’affilée — nettement au-dessus du seuil de silence ±150 g ; ce n’est ni le vent ni l’humidité.',
  'demo.evidence.f1.1':
    'Hygromètre : humidité de la partie à couvain à la limite supérieure de la norme — 50 % (norme 40–50 %) alors qu’il fait sec dehors (52 %) — la colonie a inondé les rayons de nectar frais et a mis en route le séchage.',
  'demo.evidence.f1.2':
    'Acoustique : le bourdonnement s’est déplacé à 265 Hz — la colonie a mis en route la ventilation pour sécher le nectar.',
  'demo.evidence.f1.3':
    'Calendrier GDD : la somme des températures efficaces a atteint le seuil de floraison du tilleul (jusqu’à 1000 kg/ha) — la source de miellée est confirmée ; à son pic, le tilleul donne à une colonie forte 10–15 kg par jour.',

  'demo.finding.f2.title': 'Pas de traitement anti-varroa pendant la miellée',
  'demo.finding.f2.summary':
    'Les balances montrent un gain commercial : tout acaricide gâterait le miel. Infestation 1,4 % — il faut attendre.',
  'demo.finding.f2.urgencyNote': 'Garder la pause',
  'demo.finding.f2.probability': 'Risque de gâter le miel commercial — élevé',
  'demo.finding.f2.risk':
    'Traiter maintenant : le miel avec des résidus d’acaricide ne peut pas être vendu, et une colonie au pic de travail subirait un stress et perdrait 2–3 jours de productivité. Un traitement reporté après l’extraction ne perd rien : l’infestation atteindra au plus 1,8 % — toujours sous le seuil.',
  'demo.finding.f2.action': 'Marquer : traitement reporté après l’extraction du miel',
  'demo.evidence.f2.0':
    'Balances : +480 g/jour — le miel commercial s’accumule ; tout traitement à l’amitraz laisserait des résidus dans le produit.',
  'demo.evidence.f2.1':
    'Caméra : 1 varroa sur le dos par roulement — infestation 1,4 %, sous le seuil de risque de 2 %.',
  'demo.evidence.f2.2':
    'Calendrier GDD : la floraison du tilleul vient de commencer — la miellée durera encore 10–14 jours.',

  'demo.finding.f3.title': 'Nectar frais : surveiller l’humidité',
  'demo.finding.f3.summary':
    '50 % d’humidité — la limite supérieure de la norme (40–50 %) : la colonie sèche le nectar. Il faut de la ventilation pour que le miel ne fermente pas.',
  'demo.finding.f3.urgencyNote': 'Dans la semaine',
  'demo.finding.f3.probability': 'Suivi de l’indicateur',
  'demo.finding.f3.risk':
    'Sous des pluies prolongées, l’évaporation s’arrêtera : le miel immature à plus de 19–20 % d’eau commence à fermenter et se gâte directement dans les rayons. La colonie perdra une partie de son miel commercial.',
  'demo.finding.f3.action': 'Entrebâiller l’entrée / renforcer la ventilation',
  'demo.evidence.f3.0':
    'Hygromètre : 50 % — limite supérieure de la norme de 40–50 % pour la partie à couvain ; le nectar frais dans les hausses demande un séchage actif.',
  'demo.evidence.f3.1':
    'Acoustique à 265 Hz — la fréquence « de travail » de la ventilation : la colonie sèche déjà le nectar à pleine puissance.',
  'demo.evidence.f3.2':
    'CO₂ 780 ppm — respiration et évaporation accrues, l’entrée reste libre.',

  'demo.finding.f4.title': 'Perte matinale de −1,4 kg — des butineuses, pas une perte',
  'demo.finding.f4.summary':
    'Le poids chute le matin et se rétablit le soir avec un surplus — la courbe classique du vol de butinage.',
  'demo.finding.f4.urgencyNote': 'Observer',
  'demo.finding.f4.probability': 'Aucune fausse alerte',
  'demo.finding.f4.risk':
    'Aucun risque : c’est une courbe journalière normale. Le filtre « seuil de silence ±150 g » écarte déjà les petites fluctuations dues au vent et aux gouttes de pluie, donc pas de fausses alertes.',
  'demo.finding.f4.action': 'Marquer : la perte de poids est confirmée comme normale',
  'demo.evidence.f4.0':
    'Balances : de 6 h 40 à 8 h 20, perte de −1,4 kg (~1400 butineuses dehors), à 20 h le poids dépasse le niveau matinal de +0,48 kg.',
  'demo.evidence.f4.1':
    'Caméra : pic de vol 08 h–11 h — 68 abeilles/min, en miroir exact du creux de poids.',
  'demo.evidence.f4.2':
    'Temps sec, vent jusqu’à 3 m/s — la perte n’est pas liée aux précipitations ni au pillage par les oiseaux.',

  // ── Prescriptions : scénario « Flambée de varroa » ──
  'demo.finding.v1.title': 'Infestation critique 3,6 % — risque élevé du virus des ailes déformées',
  'demo.finding.v1.summary':
    '3,6 % — au-dessus du seuil de 3 %. Sans traitement, la colonie contractera le virus des ailes déformées et entrera en hivernage affaiblie.',
  'demo.finding.v1.urgencyNote': 'Agir maintenant',
  'demo.finding.v1.probability': 'Probabilité de charge nuisible — 94 %',
  'demo.finding.v1.risk':
    'Dans 14 jours, l’infestation dépassera 5 % : le virus des ailes déformées (DWV) passe dans le couvain — les ailes des jeunes abeilles deviennent de « petites vitres », la colonie perd 30–50 % de sa force en 2–3 mois et entre en hivernage affaiblie. À 5 % et plus, l’hivernage est le plus souvent fatal.',
  'demo.finding.v1.action': 'Effectuer un bio-traitement à l’acide oxalique',
  'demo.evidence.v1.0':
    'Caméra à l’entrée : 7 abeilles avec des varroas sur le dos par roulement — à un trafic de 31 abeilles/min, cela extrapole à 3,4–3,7 % d’infestation.',
  'demo.evidence.v1.1':
    'Graphique d’infestation : hausse trois semaines de suite (+0,9 %/sem.), prévision à 14 jours — 5,2 %. Le traitement au trichlormétazide de juin n’a eu aucun effet (creux non marqué).',
  'demo.evidence.v1.2':
    'Contre-vérification : les ruches voisines n°1 et n°2 affichent 0,8–1,4 % — la source d’infestation est locale : c’est bien la ruche n°3, pas tout le rucher.',
  'demo.evidence.v1.3':
    'Caméra : 2 abeilles aux ailes déformées repérées à l’entrée — les premiers porteurs du DWV sont déjà apparus.',

  'demo.finding.v2.title': 'Vérifier le couvain pour le virus des ailes déformées (DWV)',
  'demo.finding.v2.summary':
    'Des abeilles aux ailes « vitrées » à l’entrée — le virus est déjà dans la colonie. Une inspection visuelle des cadres de couvain s’impose.',
  'demo.finding.v2.urgencyNote': 'Inspecter aujourd’hui',
  'demo.finding.v2.probability': 'Probabilité de DWV — 68 %',
  'demo.finding.v2.risk':
    'Dans 7–10 jours, le virus couvrira tout le couvain : une jeune génération naîtra avec des ailes défectueuses et la colonie ne constituera pas sa population pour l’hiver. Il faut isoler la reine et traiter avant le milieu du cycle de couvain.',
  'demo.finding.v2.action': 'Inspecter le couvain et joindre une photo au rapport',
  'demo.evidence.v2.0':
    'Caméra : 2 abeilles aux ailes déformées par jour à l’entrée — les malades perdent d’abord leur capacité de vol.',
  'demo.evidence.v2.1':
    'Infestation 3,6 % : le varroa est le principal vecteur du DWV ; au-dessus de 3 %, le virus se manifeste presque toujours.',
  'demo.evidence.v2.2':
    'Trafic 31 abeilles/min (−30 % par rapport au rucher) — une partie des jeunes abeilles ne sort plus butiner.',

  'demo.finding.v3.title': 'Trafic faible à l’entrée — la colonie perd du rythme',
  'demo.finding.v3.summary':
    '31 abeilles/min contre 45 en moyenne au rucher : le varroa affaiblit les butineuses et le gain baisse.',
  'demo.finding.v3.urgencyNote': 'Dans la semaine',
  'demo.finding.v3.probability': 'Lien avec l’infestation — 71 %',
  'demo.finding.v3.risk':
    'Dans 3–14 jours, l’écart de gain s’accentuera : la colonie récoltera 30–40 % de miel en moins d’ici la fin de saison, et les abeilles affaiblies hivernent mal.',
  'demo.finding.v3.action': 'Marquer : surveillance renforcée du trafic pendant 7 jours',
  'demo.evidence.v3.0':
    'Caméra : 31 abeilles/min — 30 % sous la moyenne du rucher avec une météo identique pour toutes les ruches.',
  'demo.evidence.v3.1':
    'Balances : gain de seulement +0,12 kg/jour contre +0,17 kg pour la ruche n°1 — la différence correspond à peu près à la perte d’abeilles volantes.',
  'demo.evidence.v3.2':
    'Toutes les ruches ont la même météo — le facteur météo exclut une cause de la baisse du vol.',

  'demo.finding.v4.title': 'Le traitement à l’acide oxalique ne nuira pas à la miellée',
  'demo.finding.v4.summary':
    'Le gain de la ruche est modeste (+120 g/jour), pas de flux commercial — l’acide oxalique est sûre dès maintenant.',
  'demo.finding.v4.urgencyNote': 'Planifier',
  'demo.finding.v4.probability': 'Compatibilité avec la miellée — confirmée',
  'demo.finding.v4.risk':
    'Retarder le traitement est plus dangereux que le traitement lui-même : chaque 7 jours d’attente ajoutent ~0,9 % d’infestation et augmentent le risque de DWV chez les abeilles d’hiver.',
  'demo.finding.v4.action': 'Planifier le traitement pour demain à 7 h',
  'demo.evidence.v4.0':
    'Balances : +0,12 kg/jour — sous le seuil de silence de l’accumulation commerciale ; le miel dans les hausses croît lentement.',
  'demo.evidence.v4.1':
    'Calendrier GDD : la colonie exploite à peine la miellée principale (tilleul) en raison d’un vol faible — les pertes dues au traitement sont minimes.',
  'demo.evidence.v4.2':
    'L’acide oxalique est une méthode bio : tolérée en miellée faible, elle ne laisse aucune trace dans le miel commercial (contrairement à l’amitraz).',

  // ── Prescriptions : scénario « Pré-essaimage » ──
  'demo.finding.s1.title': 'Chant des reines — l’essaim sortira dans 3–5 jours',
  'demo.finding.s1.summary':
    'L’acoustique a enregistré 390 Hz, « barbe » à l’entrée, vol en baisse de 40 %. La colonie est prête à se diviser.',
  'demo.finding.s1.urgencyNote': 'Agir maintenant',
  'demo.finding.s1.probability': 'Probabilité de départ de l’essaim — 85 %',
  'demo.finding.s1.risk':
    'Dans 3–5 jours, dès la première belle journée, l’essaim s’envolera : la colonie perdra jusqu’à 40 % de sa masse et son seul flux de travail pendant 2–3 semaines ; la ruche n°4 récoltera deux fois moins de miel. Un essaim parti n’est pas toujours rattrapable.',
  'demo.finding.s1.action': 'Inspecter les cellules royales',
  'demo.evidence.s1.0':
    'Acoustique : 390 Hz — « chant » des reines (les cellules royales mûrissent, les jeunes reines se répondent). Le bourdonnement normal d’une colonie est de 215 Hz.',
  'demo.evidence.s1.1':
    'Caméra : vol réduit de 40 % et une « barbe » d’abeilles s’est formée à l’entrée — les abeilles « chaufferettes » sont sorties de la ruche à cause de la chaleur étouffante.',
  'demo.evidence.s1.2':
    'Le CO₂ a monté à 1450 ppm à cause de l’entassement (norme jusqu’à 800) — la ruche est surpeuplée.',
  'demo.evidence.s1.3':
    'Capteur de température : la partie à couvain reste stable à 35,0 °C, mais dans la zone des cellules royales (construction des rayons) les abeilles ont élevé la température à 41 °C — la colonie réchauffe un grand volume de construction fraîche.',

  'demo.finding.s2.title': 'Étouffant dans la ruche — augmenter volume et ventilation',
  'demo.finding.s2.summary':
    'CO₂ 1450 ppm avec une « barbe » à l’entrée : la colonie manque physiquement de volume et d’air.',
  'demo.finding.s2.urgencyNote': 'Aujourd’hui',
  'demo.finding.s2.probability': 'Cause de l’étouffement — entassement',
  'demo.finding.s2.risk':
    'Dans 3–7 jours, la surchauffe du couvain (au-dessus de 36 °C) tuera une partie du couvain operculé, et l’étouffement accélérera l’essaimage — pour la colonie, il est plus facile de partir que d’endurer.',
  'demo.finding.s2.action': 'Retirer la partition / agrandir le nid',
  'demo.evidence.s2.0':
    'CO₂ 1450 ppm — deux fois la norme de travail de 600–800 ppm ; indice COV 87 — l’air de la ruche est « lourd ».',
  'demo.evidence.s2.1':
    'Humidité 56 % — au-dessus de la norme de la partie à couvain (40–50 %) ; l’humidité ne s’évapore pas : la ventilation n’y arrive pas.',
  'demo.evidence.s2.2':
    'Une « barbe » à l’entrée — des centaines d’abeilles pendent dehors parce qu’il n’y a plus de place à l’intérieur.',

  'demo.finding.s3.title': 'Faire une division artificielle (essaim artificiel)',
  'demo.finding.s3.summary':
    'La technique classique : détourner l’énergie d’essaimage vers la formation d’une nouvelle colonie au lieu de la perdre dans les airs.',
  'demo.finding.s3.urgencyNote': 'Aujourd’hui avant le soir',
  'demo.finding.s3.probability': 'L’effet est éprouvé par la pratique',
  'demo.finding.s3.risk':
    'Si la colonie essaime d’elle-même : un essaim avec une reine vierge peut s’envoler à 5–10 km, et la vieille colonie restera sans butineuses pendant 3 semaines. Une division contrôlée préserve les deux parties de la colonie.',
  'demo.finding.s3.action': 'Faire un essaim artificiel sur 3 cadres de couvain',
  'demo.evidence.s3.0':
    'Acoustique 390 Hz — les cellules royales mûrissent déjà : la colonie est « engagée » vers l’essaimage ; l’annuler par une seule extension n’est pas garanti.',
  'demo.evidence.s3.1':
    'Balances : le gain s’est presque arrêté (+0,05 kg/jour) — la colonie ne construit ni ne récolte ; toute son énergie va à la préparation de l’essaim.',
  'demo.evidence.s3.2':
    'La force de la colonie est élevée (perte matinale de −1,4 kg les jours ordinaires) — un essaim artificiel sur 3 cadres de couvain sera pleinement viable.',

  'demo.finding.s4.title': 'Garder les 2 meilleures cellules royales, supprimer les autres',
  'demo.finding.s4.summary':
    '8 cellules royales, c’est trop : contrôler leur nombre réduit l’essaimage secondaire.',
  'demo.finding.s4.urgencyNote': 'Dans la semaine',
  'demo.finding.s4.probability': 'Risque d’essaimage secondaire sans mesure — 55 %',
  'demo.finding.s4.risk':
    'Dans 7–14 jours après l’essaim primaire, la colonie peut essaimer de nouveau avec une jeune reine (« essaimage silencieux ») — et ainsi de suite jusqu’à l’épuisement complet. Le contrôle des cellules royales est une prévention standard.',
  'demo.finding.s4.action': 'Supprimer les cellules royales superflues, en garder 2',
  'demo.evidence.s4.0':
    'Acoustique : le chant des reines s’entend déjà — plusieurs reines mûrissent simultanément dans la colonie, signe classique d’essaimage secondaire « silencieux ».',
  'demo.evidence.s4.1':
    'Capteur de température : 41 °C dans la zone des cellules royales — les abeilles chauffent la construction des rayons à 40–42 °C, tandis que la partie à couvain garde des constantes 35,0 °C.',
  'demo.evidence.s4.2':
    'Trafic réduit — la vieille reine est déjà limitée dans sa ponte ; la colonie est passée à la reproduction.',

  // ── Rapport du soir ──
  'demo.evening.weight.title': 'Gain net de nectar',
  'demo.evening.weight.text':
    'Après le retour des butineuses, le rucher a gagné {gain} kg en une journée. Meilleure journée pour la ruche n°{bestHive} — {best} kg (séchage du nectar à {hz} Hz). Les pertes matinales des butineuses ont été partout compensées par la croissance du soir.',
  'demo.evening.varroa.title': 'État de l’infestation',
  'demo.evening.varroa.item': 'n°{n} — {p} % ({s})',
  'demo.evening.varroa.itemF': 'n°{n} — {p} % ({s}, prévision {f} %)',
  'demo.evening.varroa.text':
    '{list}. Le seuil critique est 3 % : la ruche n°3 exige un traitement à l’acide oxalique — prévision à 14 jours : {f3} %.',
  'demo.evening.bloom.title': 'Floraison selon le GDD',
  'demo.evening.bloom.text':
    'Somme des températures efficaces {cur} sur {need} — {name} fleurira dans environ {d} jours (seuil atteint à {pct} %). Vérifiez le volume des ruches avant le début de la floraison.',
  'demo.evening.weather.title': 'Fenêtre de vol pour demain',
  'demo.evening.weather.text':
    'Prévisions : ciel clair jusqu’à +24 °C, vent jusqu’à 3 m/s, précipitations 10 % — bonnes conditions de vol. Mieux vaut inspecter avant 11 h ou après 17 h pour ne pas gêner les butineuses.',
  'demo.evening.done.title': 'Prescriptions de l’agent',
  'demo.evening.done.text':
    'Prescriptions accomplies en 24 heures : {n}. Les indices des ruches ont été recalculés en tenant compte des actions effectuées.',
  'demo.evening.doneNone.title': 'Prescriptions de l’agent',
  'demo.evening.doneNone.text':
    'Aucune prescription accomplie en 24 heures — ouvrez une carte de prescription et appuyez sur « Accomplir » pour marquer l’action.',

  // ── Graphiques, unités, divers ──
  'demo.chart.gainLabel': 'Gain quotidien',
  'demo.chart.nightLabel': 'La nuit',
  'demo.chart.weightLabel': 'Poids',
  'demo.unit.kg': 'kg',
  'demo.unit.hz': 'Hz',
  'demo.unit.beesMin': 'abeilles/min',
  'demo.unit.km': 'km',
  'demo.hives.all4': '4 ruches',
  'demo.agent.discussMsg': 'Discutons de la prescription pour la ruche n°{n} : {title}',
}

const KK: Dict = {
  // ── Пестицидтік баннер және GDD фактілері ──
  'dash.pesticide.text':
    '20 шілдеде «Заречное» рапс аланы «Каратэ Зеон» инсектицидімен өңделеді (лямбда-цигалотрин — аралар үшін қауіптілік класы I). Алан 2,4 км жерде, жел пасекаға қарай соғады.',
  'dash.pesticide.desc':
    '«Каратэ Зеон» пиретроиды аралар үшін өте қауіпті (I класс): регламент өңдеуді күн батқаннан кейін кешке, жел жылдамдығы 1–2 м/с аспайтын кезде жүргізуге рұқсат етеді. Пестицидтерді қолдану заңы бойынша арашылар 10–5 күн бұрын ескертіледі, ал 7 км радиустегі барлық пасекалар хабарлама алуға міндетті.',
  'dash.pesticide.step1':
    'Өңдеу терезесін нақтылаңыз: пиретроидтар +10…+20 °C-та, әдетте күн батқаннан кейін кешке, жел 1–2 м/с дейін кезде қолданылады — фуражирлар ұшпай тұрып үлгеріңіз.',
  'dash.pesticide.step2':
    '«Көшу» нұсқасы: пасеканы «Заречное» аланынан 5–7 км жерге шығару — аралардың қорғаныш ұшу аймағынан тыс жерге («Көшіру» бөлімі жоспар құрады).',
  'dash.pesticide.step4':
    'Өңдеуден кейін: аралардың қайтуын бақылау; жаппай қырылу болған жағдайда сынамалар жинап, аудан әкімшілігін хабарландыру. Прецедент: Башқұртстан, 2019 — рапс өңделгеннен кейін 40–45 мың ара өлген.',
  'dash.gdd.note.acacia': 'алғашқы күшті алым',
  'dash.gdd.note.sunflower': '13–57 кг/га, жалпы жинақ 60 кг дейін',
  'dash.gdd.note.linden': 'гектарына 800–1000 кг дейін, отбасы тәулікте 10–15 кг алады',
  'dash.gdd.note.buckwheat': '60–360 кг/га, тәуліктік алым 3–7 кг',

  // ── Балды өсімдіктер ──
  'demo.crop.acacia': 'Ақация',
  'demo.crop.sunflower': 'Күнбағыс',
  'demo.crop.linden': 'Жөке',
  'demo.crop.buckwheat': 'Қыздық',

  // ── Дәлел сенсорларының белгілері ──
  'demo.evidence.sensor.scales': 'Ақылды таразылар',
  'demo.evidence.sensor.mic': 'Акустика',
  'demo.evidence.sensor.cam': 'Жаңқадағы камера',
  'demo.evidence.sensor.gas': 'Газ сенсоры',
  'demo.evidence.sensor.temp': 'Жылулық сенсор',
  'demo.evidence.sensor.hum': 'Гигрометр',
  'demo.evidence.sensor.gdd': 'GDD күнтізбесі',
  'demo.evidence.sensor.weather': 'Ауа райы болжамы',
  'demo.evidence.sensor.stats': 'Өңдеу статистикасы',

  // ── Basis сенсор белгілері ──
  'demo.basis.scales': 'Терезелер',
  'demo.basis.mic': 'Акустика',
  'demo.basis.cam': 'Камера',
  'demo.basis.temp': 'Жылулық сенсор',
  'demo.basis.gdd': 'GDD',
  'demo.basis.stats': 'Өңдеу статистикасы',
  'demo.basis.weather': 'Ауа райы болжамы',
  'demo.basis.hum': 'Гигрометр',
  'demo.basis.gas': 'Газ сенсоры',

  // ── Ауа және трафик күйі ──
  'demo.voc.hot': 'Тұншығу — отбасыға көлем жетіспейді',
  'demo.voc.mid': 'Ауамен орташа жүктеме',
  'demo.voc.ok': 'Ауа таза',
  'demo.traffic.high': 'Қарқынды ұшу',
  'demo.traffic.active': 'Белсенді ұшу',
  'demo.traffic.weak': 'Ұшу әлсіреген',
  'demo.traffic.low': 'Ұшу күрт төмендеген',

  // ── Улей жолақтары ──
  'demo.hive.0.label': 'Бүкіл пасека',
  'demo.hive.0.scenarioHint': 'Пасеканың орташа көрсеткіштері · 1 улейде критикалық жұқтыру, 1 рой алдында',
  'demo.hive.0.entranceLabel': 'Пасека бойынша ұшу белсенді',
  'demo.hive.0.acousticLabel': 'Пасеканың орташа гуі — алымда жұмыс',
  'demo.hive.0.corps': '4 улей · 12 корпус · 1 магазин',
  'demo.hive.1.label': 'Улей №1',
  'demo.hive.1.scenarioHint': 'Индекс 9,2 · жұқтыру 0,8 % · тұрақты алым',
  'demo.hive.1.entranceLabel': 'Белсенді ұшу',
  'demo.hive.1.acousticLabel': 'Отбасының біркелкі гуі — норма',
  'demo.hive.1.corps': '3 корпус (дадан)',
  'demo.hive.2.label': 'Улей №2',
  'demo.hive.2.scenarioHint': 'Индекс 8,8 · алым +480 г/тәулік · ылғалдылық 50 % (нектарды кептіру)',
  'demo.hive.2.entranceLabel': 'Қарқынды ұшу — алым шыңы',
  'demo.hive.2.acousticLabel': 'Желдету: жаңа нектарды кептіру',
  'demo.hive.2.corps': '3 корпус + 1 магазин (дадан)',
  'demo.hive.2.queenBreed': 'Бакфаст',
  'demo.hive.2.queenMark': 'жасыл белгі',
  'demo.hive.3.label': 'Улей №3',
  'demo.hive.3.scenarioHint': 'Индекс 4,8 · жұқтыру 3,6 % · қанат деформациясы вирусының қаупі',
  'demo.hive.3.entranceLabel': 'Ұшу әлсіреген (пасекадан −30 %)',
  'demo.hive.3.acousticLabel': 'Түрліше тонды гуі — отбасы мазасыздануда',
  'demo.hive.3.corps': '3 корпус (дадан)',
  'demo.hive.3.queenBreed': 'Карника',
  'demo.hive.3.queenMark': 'сары белгі',
  'demo.hive.4.label': 'Улей №4',
  'demo.hive.4.scenarioHint': 'Индекс 5,5 · аналық ұяшықтары 41 °C · аналық жыны · жаңқада «сақал»',
  'demo.hive.4.entranceLabel': 'Аралар «сақал» болып жиналған — ройлану қаупі',
  'demo.hive.4.acousticLabel': 'Аналық жыны: рой 3–5 күннен кейін шығады',
  'demo.hive.4.corps': '3 корпус (дадан)',
  'demo.hive.4.queenBreed': 'Жергілікті орталықорыс',
  'demo.hive.4.queenMark': 'белгісіз',

  // ── Предписания: «Норма» сценарийі ──
  'demo.finding.n1.title': 'Отбасы қалыпты дамуда',
  'demo.finding.n1.summary': 'Алты сенсор тобы да нормада — бақылауды жалғастырыңыз, араласу қажет емес.',
  'demo.finding.n1.urgencyNote': 'Бақылау',
  'demo.finding.n1.probability': 'Ауытқулар табылмады',
  'demo.finding.n1.risk':
    'Қауіп жоқ: ағымдағы көрсеткіштер сақталса, отбасы шығынсыз күшін артта береді. Келесі бақылау нүктесі — 7 күннен кейінгі жоспарлы қарау.',
  'demo.finding.n1.action': 'Белгілеу: жоспарлы қарау орындалды',
  'demo.evidence.n1.0':
    'Терезелер: 5 күн қатарынан +0,16…+0,19 кг/тәулік біркелкі алым — құлдырау мен секіріс жоқ (±150 г тыныш шегі жел мен жаңбырды алып тастайды).',
  'demo.evidence.n1.1':
    'Жылулық сенсор: балапан бөлігінде 35,0 °C — температура тұрақты, қажеттілігіндей (норма). Шеттері 1–2 °C төмен, жем бөлігі ≈ 30 °C.',
  'demo.evidence.n1.2': 'Акустика: 215 Гц біркелкі гуі — отбасы тыныш, желдету де, аналық жыны да жоқ.',
  'demo.evidence.n1.3':
    'Жаңқадағы камера: ауысымда арқаларда 0 кене, трафик 42 ара/мин — ұшу толыққанды.',

  'demo.finding.n2.title': 'Магазин қосу уақыты келді',
  'demo.finding.n2.summary': 'Бос араалы екі рамкадан аз қалды — отбасы көп ұзамай көлем тұсына тығылады.',
  'demo.finding.n2.urgencyNote': 'Апта ішінде',
  'demo.finding.n2.probability': 'Араалы жетіспеу ықтималдығы — 82 %',
  'demo.finding.n2.risk':
    '5–8 күннен кейін барлық араалы бал мен балапанға толады: отбасы аналықты жұмыртқалаудан шектейді, бал жинау қарқыны 20–30 % төмендейді, ал тарлық ройлануға итермелейді.',
  'demo.finding.n2.action': 'Уяны кеңейту / магазин қою',
  'demo.evidence.n2.0':
    'Терезелер: +0,17 кг/тәулік тұрақты — отбасы күн сайын нектар әкеледі және жоғарғы корпустың дерлік барлығын бал астына алды.',
  'demo.evidence.n2.1':
    'Камера: қайтқан 10 араның 6-сы тозаң әкеледі — күшті алым жалғасады, көлем 3–4 күннен кейін қажет болады.',
  'demo.evidence.n2.2': 'GDD күнтізбе: температура жиынтығы ақация гүлдеуінің шегіне жетті — нектар ағыны күшейеді.',

  'demo.finding.n3.title': 'Жұқтыру нормада — ем қажет емес',
  'demo.finding.n3.summary': '0,8 % — қауіп шегінен екі есе төмен. Қазір химия алымдағы отбасына тек алаңдатады.',
  'demo.finding.n3.urgencyNote': 'Бақылау',
  'demo.finding.n3.probability': 'Болжам +14 күн: 0,9 % — әлі де норма',
  'demo.finding.n3.risk':
    'Жаңа өңдеусіз қыркүйекке қарай жұқтыру ~1,3 %-ке жетеді — қауіпсіз аймақта қалады. Қанат деформациясы вирусының қаупі ең төмен.',
  'demo.finding.n3.action': '14 күннен кейін бақылау санағын жоспарлау',
  'demo.evidence.n3.0':
    'Камера: бақылау ауысымында аралардың арқасында 0 кене (тәулігіне 3-ке дейін алаңдатар еді).',
  'demo.evidence.n3.1':
    'Жұқтыру графигі: маусымдағы қымыздық қышқылымен өңдеуден кейін көрсеткіш 12 күн бойы 0,7–0,8 % деңгейінде — өңдеу жұмыс істеді.',
  'demo.evidence.n3.2': 'Терезелер тұрақты алым көрсетуде — отбасы мықты, кенеден әлсіреу жоқ.',

  'demo.finding.n4.title': 'Ертең ұшуға тамаша терезе',
  'demo.finding.n4.summary':
    '+24 °C дейін, жел 3 м/с дейін, жауын-шашын 10 % — фуражирлердің максималды ұшуы, қарауларды жоспарламаған дұрыс.',
  'demo.finding.n4.urgencyNote': 'Ұшу терезесін пайдалану',
  'demo.finding.n4.probability': '10 күндік болжам бойынша',
  'demo.finding.n4.risk':
    'Терезе жіберілсе қауіп жоқ, бірақ алымның 1 күні жоғалады: +180 г/тәулік алымда бұл тек бір улейден ~0,2 кг бал.',
  'demo.finding.n4.action': 'Белгілеу: қарау арғы күнге қалдырылды',
  'demo.evidence.n4.0':
    'Болжам: ертең ашық, +24 °C дейін, жел 3 м/с, жауын-шашын ықтималдығы 10 % — ұшу жағдайлары «жақсы».',
  'demo.evidence.n4.1':
    'Терезелер: таңғы төмендеу −1,1 кг және кешке қарай тез қалпына келеді — фуражирлер тәулік бойы еңбектенеді.',

  // ── Предписания: «Белсенді бал жинау» сценарийі ──
  'demo.finding.f1.title': 'Белсенді бал жинау — отбасы жөкеде жұмыс істейді',
  'demo.finding.f1.summary': 'Алым +480 г/тәулік, отбасы нектарды кептіру режиміне көшті. Жаңа балға көлем беретін уақыт жетті.',
  'demo.finding.f1.urgencyNote': 'Бүгін',
  'demo.finding.f1.probability': 'Тұрақты алым ықтималдығы — 91 %',
  'demo.finding.f1.risk':
    'Осы қарқынмен 3–5 күннен кейін араалы толады: қосымша көлемсіз отбасы аналықты шектейді, нектар ылғалды баяу жоғалта бастайды — ауа райы өзгергенде қышу қаупі.',
  'demo.finding.f1.action': 'Уяны кеңейту / магазин қою',
  'demo.evidence.f1.0':
    'Терезелер: 3 күн қатарынан +460…+480 г/тәулік алым — ±150 г тыныш шегінен айтарлықтай жоғары, бұл да жел, да ылғал емес.',
  'demo.evidence.f1.1':
    'Гигрометр: балапан бөлігінің ылғалдылығы норманың жоғарғы шегінде — 50 % (норма 40–50 %), сырты құрғақ (52 %) — отбасы араалыды жаңа нектармен толтырды және кептіруді қосты.',
  'demo.evidence.f1.2': 'Акустика: гуі 265 Гц-ке жылжыды — отбасы нектарды кептіру үшін желдетуді қосты.',
  'demo.evidence.f1.3':
    'GDD күнтізбе: тиімді температура жиынтығы жөке гүлдеуінің шегіне жетті (гектарына 1000 кг дейін) — алым көзі расталды; шыңында жөке мықты отбасыға тәулікте 10–15 кг береді.',

  'demo.finding.f2.title': 'Алым кезінде кенеге өңдеу жасамау',
  'demo.finding.f2.summary': 'Терезелер тауарлық алым көрсетуді: қазір кез келген акарицид балды бұзады. Жұқтыру 1,4 % — күтетін уақыт.',
  'demo.finding.f2.urgencyNote': 'Паузаны ұстаңыз',
  'demo.finding.f2.probability': 'Тауарлық балды бұзу қаупі — жоғары',
  'demo.finding.f2.risk':
    'Қазір өңдесе: акарицид қалдығы бар бал сатуға болмайды, ал шың еңбектегі отбасы стреске ұшырап 2–3 күн өнімділік жоғалтады. Бал айдан кейінгі өңдеуге кейінге қалдыру ештеңе жоғалтпайды: жұқтыру көп дегенде 1,8 %-ға жетеді — әлі де шектен төмен.',
  'demo.finding.f2.action': 'Белгілеу: өңдеу бал айдағанға дейін қалдырылды',
  'demo.evidence.f2.0':
    'Терезелер: +480 г/тәулік — тауарлық бал жиналуда, кез келген амитраз өңдеуі өнімде із қалдырады.',
  'demo.evidence.f2.1': 'Камера: ауысымда арқаларда 1 кене — жұқтыру 1,4 %, қауіп шегі 2 %-ден төмен.',
  'demo.evidence.f2.2': 'GDD күнтізбе: жөке гүлдеуі жаңа басталды — бал жинау тағы 10–14 күн жалғасады.',

  'demo.finding.f3.title': 'Жаңа нектар: ылғалдылықты бақылау',
  'demo.finding.f3.summary': 'Ылғалдылық 50 % — норманың жоғарғы шегі (40–50 %): отбасы нектарды кептіруді. Бал қышпайтыны үшін желдету керек.',
  'demo.finding.f3.urgencyNote': 'Апта ішінде',
  'demo.finding.f3.probability': 'Көрсеткішті бақылау',
  'demo.finding.f3.risk':
    'Созылмалы жаңбырда булану тоқтайды: ылғалдылығы 19–20 %-дан асатын піспеген бал қышып, тікелей араалыда бұзылады. Отбасы тауарлық балдың бір бөлігін жоғалтады.',
  'demo.finding.f3.action': 'Жаңқаны ашықтау / желдетуді күшейту',
  'demo.evidence.f3.0': 'Гигрометр: 50 % — балапан бөлігі үшін 40–50 % нормасының жоғарғы шегі; магазиндардағы жаңа нектар белсенді кептіруді қажет етеді.',
  'demo.evidence.f3.1': 'Акустика 265 Гц — желдетудің «жұмыс» жиілігі: отбасы нектарды толық қуатпен кептіруді.',
  'demo.evidence.f3.2': 'CO₂ 780 ppm — күшейтілген тыныс алу мен булану, жаңқа сонымен қатар бос.',

  'demo.finding.f4.title': 'Таңғы төмендеу −1,4 кг — бұл фуражирлер, шығын емес',
  'demo.finding.f4.summary': 'Салмақ таңертең төмендеп, кешке пайдамен қалпына келеді — алымға ұшудың классикалық қисығы.',
  'demo.finding.f4.urgencyNote': 'Бақылау',
  'demo.finding.f4.probability': 'Жалған іске қосулар жоқ',
  'demo.finding.f4.risk':
    'Қауіп жоқ: бұл тәуліктің қалыпты қисығы. «±150 г тыныш шегі» сүзгісі жел мен жаңбыр тамшысының ұсақ тербелістерін алып тастайды, сондықтан жалған дабыл болмайды.',
  'demo.finding.f4.action': 'Белгілеу: салмақ төмендеуі норма ретінде расталды',
  'demo.evidence.f4.0':
    'Терезелер: 6:40-тан 8:20-ға дейін −1,4 кг төмендеу (~1400 фуражир ұшты), 20:00-ге қарай салмақ таңғыдан +0,48 кг жоғары.',
  'demo.evidence.f4.1': 'Камера: ұшу шыңы 08:00–11:00 — 68 ара/мин, салмақ құлдырауымен айна бейніндей сәйкес.',
  'demo.evidence.f4.2': 'Ауа райы құрғақ, жел 3 м/с дейін — төмендеу жауын-шашынмен де, құстармен де байланыс емес.',

  // ── Предписания: «Жұқтыру өршуі» сценарийі ──
  'demo.finding.v1.title': 'Критикалық жұқтыру 3,6 % — қанат деформациясы вирусының жоғары қаупі',
  'demo.finding.v1.summary': '3,6 % — 3 % шегінен жоғары. Өңдеусіз отбасы қанат деформациясы вирусын жұқтырып, қысталуға әлсірей кіреді.',
  'demo.finding.v1.urgencyNote': 'Қазір әрекет ету',
  'demo.finding.v1.probability': 'Зиянды жүктеме ықтималдығы — 94 %',
  'demo.finding.v1.risk':
    '14 күннен кейін жұқтыру 5 %-ден асады: қанат деформациясы вирусы (DWV) балапанға өтеді — жас аралардың қанаттары «әйнек сияқты» болады, отбасы 2–3 айда күшінің 30–50 %-ын жоғалтып, әлсіреп қысталуга кіреді. 5 % және одан жоғарыда қысталу көбіне ажалға әкеледі.',
  'demo.finding.v1.action': 'Қымыздық қышқылымен био-өңдеу жүргізу',
  'demo.evidence.v1.0':
    'Жаңқадағы камера: ауысымда арқасында кенесі бар 7 ара — 31 ара/мин трафикте бұл 3,4–3,7 % жұқтыруға экстраполяция.',
  'demo.evidence.v1.1':
    'Жұқтыру графигі: үш аптқа қатарынан өсім (+0,9 %/апта), 14 күндік болжам — 5,2 %. Маусымдағы трихлорметазид өңдеуі нәтиже бермеді (дип білінбеген).',
  'demo.evidence.v1.2':
    'Кросс-тексеру: көрші №1 және №2 улейдердің көрсеткіші 0,8–1,4 % — жұқтыру көзі жергілікті, мәселе дәл №3 улейде, тұтас пасекада емес.',
  'demo.evidence.v1.3':
    'Камера: жаңқа маңында қанаттары деформацияланған 2 ара байқалды — DWV алғашқы тасымалдаушылары пайда болды.',

  'demo.finding.v2.title': 'Балапанды қанат деформациясы вирусына (DWV) тексеру',
  'demo.finding.v2.summary': 'Жаңқада «әйнектей» қанатты аралар — вирус әлдеқашан отбасында. Балапан рамкаларын көзбен қарау қажет.',
  'demo.finding.v2.urgencyNote': 'Бүгін қарау',
  'demo.finding.v2.probability': 'DWV ықтималдығы — 68 %',
  'demo.finding.v2.risk':
    '7–10 күннен кейін вирус бүкіл балапанды қамтиды: қанаты ақаулы жас ұрпақ шығады, отбасы қысталуға ара жинай алмайды. Аналықты оқшаулап, емдеу балапан циклінің ортасына дейін керек.',
  'demo.finding.v2.action': 'Балапанды қарап, есепке фото тіркеу',
  'demo.evidence.v2.0':
    'Камера: тәулікте жаңқада қанаты деформацияланған 2 ара — ауырғандар алдымен ұшу қабілетін жоғалтады.',
  'demo.evidence.v2.1': 'Жұқтыру 3,6 %: кене — DWV негізгі тасымалдаушысы, көрсеткіш 3 %-ден жоғарыда вирус дерлік әрдайым байқалады.',
  'demo.evidence.v2.2': 'Трафик 31 ара/мин (пасекадан −30 %) — жас аралардың бір бөлігі енді жұмысқа ұшпайды.',

  'demo.finding.v3.title': 'Жаңқадағы трафик әлсіз — отбасы қарқынын жоғалтуда',
  'demo.finding.v3.summary': '31 ара/мин — пасеканың орташа 45-іне қарсы: кене ұшатын араларды әлсіретеді, алым төмендеуде.',
  'demo.finding.v3.urgencyNote': 'Апта ішінде',
  'demo.finding.v3.probability': 'Жұқтырумен байланыс — 71 %',
  'demo.finding.v3.risk':
    '3–14 күннен кейін алым айырмасы өседі: отбасы маусым аяғына дейін 30–40 % кем бал жинайды, әлсіреген аралар нашар қыстайды.',
  'demo.finding.v3.action': 'Белгілеу: трафикті 7 күн бойы күшейтілген бақылау',
  'demo.evidence.v3.0': 'Камера: 31 ара/мин — барлық улейге бірдей ауа райында пасека орташасынан 30 % төмен.',
  'demo.evidence.v3.1':
    'Терезелер: алым небары +0,12 кг/тәулік, №1 улейде +0,17 кг — айырма ұшатын аралардың жоғалуымен шамамен тең.',
  'demo.evidence.v3.2': 'Барлық улей үшін ауа райы бірдей — ауа райы факторы ұшу төмендеуінің себебін жоққа шығарады.',

  'demo.finding.v4.title': 'Қымыздық қышқылымен өңдеу алымға зиян тигізбейді',
  'demo.finding.v4.summary': 'Улейдің алымы қарапайым (+120 г/тәулік), тауарлық ағын жоқ — қымыздық қышқылы қазір қауіпсіз.',
  'demo.finding.v4.urgencyNote': 'Жоспарлау',
  'demo.finding.v4.probability': 'Алыммен үйлесімділігі — расталды',
  'demo.finding.v4.risk':
    'Өңдеуді кейінге қалдыру өз емінен қауіпті: әр 7 күн кідіріс жұқтыруға ~0,9 % қосып, қыстайтын араларда DWV қаупін арттырады.',
  'demo.finding.v4.action': 'Өңдеуді ертең сағат 7:00-ге жоспарлау',
  'demo.evidence.v4.0':
    'Терезелер: +0,12 кг/тәулік — тауарлық жинақтың тыныш шегінен төмен, магазиндардағы бал баяу қосылуда.',
  'demo.evidence.v4.1': 'GDD күнтізбе: отбасы ұшудың әлсіздігінен негізгі алымды (жөке) дерлік пайдаланбайды — өңдеуден зиян ең төмен.',
  'demo.evidence.v4.2': 'Қымыздық қышқылы — био-әдіс: әлсіз алым кезінде рұқсат етіледі, тауарлық балда із қалдырмайды (амитраздан өзгеше).',

  // ── Предписания: «Рой алдындағы күй» сценарийі ──
  'demo.finding.s1.title': 'Аналық жыны — рой 3–5 күннен кейін шығады',
  'demo.finding.s1.summary': 'Акустика 390 Гц тіркеді, жаңқа «сақалда», ұшу 40 % төмендеді. Отбасы бөлінуге дайын.',
  'demo.finding.s1.urgencyNote': 'Қазір әрекет ету',
  'demo.finding.s1.probability': 'Рой шығу ықтималдығы — 85 %',
  'demo.finding.s1.risk':
    '3–5 күннен кейін алғашқы жақсы күнде рой ұшып кетеді: отбасы массасының 40 %-ын және 2–3 аптаға жалғыз жұмыс ағынын жоғалтады, №4 улей екі есе кем бал жинайды. Шығып кеткен ройды әрдайым ұстап қалу мүмкін емес.',
  'demo.finding.s1.action': 'Аналық ұяшықтарын қарау',
  'demo.evidence.s1.0':
    'Акустика: 390 Гц — аналықтардың «жыны» (аналық ұяшықтары пісуде, жас аналықтар бір-біріне жауап береді). Отбасының қалыпты гуі — 215 Гц.',
  'demo.evidence.s1.1':
    'Камера: ұшу 40 % төмендеп, жаңқада аралардан «сақал» пайда болды — «жылытқыш» аралар ауаның тұншығуынан улейден шықты.',
  'demo.evidence.s1.2': 'Тығыздықтан CO₂ 1450 ppm-ге көтерілді (норма 800-ге дейін) — улей толып кеткен.',
  'demo.evidence.s1.3': 'Жылулық сенсор: балапан бөлігі тұрақты — 35,0 °C, бірақ аналық ұяшықтары аймағында (араалы құрылысы) аралар температураны 41 °C-ке көтерді — отбасы кең жаңа құрылысты жылытып тұр.',

  'demo.finding.s2.title': 'Улейде тұншығу — көлем мен желдетуді кеңейту',
  'demo.finding.s2.summary': 'Жаңқада «сақал» тұрғанда CO₂ 1450 ppm: отбасыға көлем мен ауа жетіспейді.',
  'demo.finding.s2.urgencyNote': 'Бүгін',
  'demo.finding.s2.probability': 'Тұншығу себебі — тығыздық',
  'demo.finding.s2.risk':
    '3–7 күннен кейін балапанның қызып кетуі (36 °C-тан жоғары) басылған балапанның бір бөлігінің өлуіне әкеледі, тұншығу ройлануды жеделдетеді — отбасыға шыдамдылық танытқанша ұшып кету жеңіл.',
  'demo.finding.s2.action': 'Диафрагманы алып тастау / уяны кеңейту',
  'demo.evidence.s2.0': 'CO₂ 1450 ppm — жұмыс нормасы 600–800 ppm-нен екі есе жоғары; ЛОС индексі 87 — улейдегі ауа «ауыр».',
  'demo.evidence.s2.1': 'Ылғалдылық 56 % — балапан бөлігі нормасынан жоғары (40–50 %), ылғал буланбайды: желдету істей алмайды.',
  'demo.evidence.s2.2': 'Жаңқада «сақал» — жүздеген ара сыртта ілініп тұр, өйткені ішінде орын жоқ.',

  'demo.finding.s3.title': 'Жасанды бөлу жасау (отводок)',
  'demo.finding.s3.summary': 'Классикалық тәсіл: ройлық энергияны жаңа отбасы қалыптастыруға бұрып, ауада жоғалтпай қою.',
  'demo.finding.s3.urgencyNote': 'Бүгін кешке дейін',
  'demo.finding.s3.probability': 'Әсері практикалық тексерілген',
  'demo.finding.s3.risk':
    'Отбасының өз бетінше ройлануына жол берілсе: ұрықтанбаған аналықпен рой 5–10 км ұшып кетуі мүмкін, ескі отбасы 3 аптаға ұшатын араларсыз қалады. Бақыланатын отводок отбасының екі бөлігін сақтайды.',
  'demo.finding.s3.action': '3 балапан рамкасынан отводок жасау',
  'demo.evidence.s3.0': 'Акустика 390 Гц — аналық ұяшықтары әлдеқашан пісуде: отбасы ройлануға «бағыт алды», тек кеңейтуден оның жойылуына кепілдік жоқ.',
  'demo.evidence.s3.1': 'Терезелер: алым іс жүзінде тоқтады (+0,05 кг/тәулік) — отбасы да салмайды, да жинамайды, барлық энергия ройға дайындалуда.',
  'demo.evidence.s3.2': 'Отбасының күші жоғары (қарапайым күндері таңғы төмендеу −1,4 кг) — 3 балапан рамкасына жасалған отводок толыққанды болады.',

  'demo.finding.s4.title': 'Ең жақсы 2 аналық ұяшығын қалдырып, қалғанын кесу',
  'demo.finding.s4.summary': '8 аналық ұяшығы — артық: олардың санын бақылау қайта ройлануды азайтады.',
  'demo.finding.s4.urgencyNote': 'Апта ішінде',
  'demo.finding.s4.probability': 'Шарасыз қайта ройлану қаупі — 55 %',
  'demo.finding.s4.risk':
    'Бірінші ройдан кейін 7–14 күн өткенде отбасы жас аналықпен қайта ройлануы мүмкін («тыныш» ройлану) — толық әлсіреуге дейін осылай. Аналық ұяшықтарын бақылау — стандартты алдын алу.',
  'demo.finding.s4.action': 'Артық аналық ұяшықтарын кесіп, 2-сін қалдыру',
  'demo.evidence.s4.0': 'Акустика: аналық жыны қазір-ақ естіледі — отбасында бірнеше аналық мезгілінде пісуде, бұл «тыныш» қайта ройланудың классикалық белгісі.',
  'demo.evidence.s4.1': 'Жылулық сенсор: аналық ұяшықтары аймағында 41 °C — аралар араалы құрылысын 40–42 °C-қа дейін жылытып тұр; балапан бөлігі тұрақты 35,0 °C ұстап тұр.',
  'demo.evidence.s4.2': 'Трафик төмендеген — ескі аналық жұмыртқалауда шектелген, отбасы көбейтуге көшті.',

  // ── Кешкі есеп ──
  'demo.evening.weight.title': 'Таза нектар алымы',
  'demo.evening.weight.text':
    'Фуражирлер қайтып келгеннен кейін пасека тәулікте {gain} кг қосты. Ең жақсы күн №{bestHive} улейде — {best} кг ({hz} Гц-те нектар кептіру). Таңғы фуражир төмендеулері барлық жерде кешкі өсіммен өтелді.',
  'demo.evening.varroa.title': 'Жұқтыру жағдайы',
  'demo.evening.varroa.item': '№{n} — {p} % ({s})',
  'demo.evening.varroa.itemF': '№{n} — {p} % ({s}, болжам {f} %)',
  'demo.evening.varroa.text': '{list}. Сынық шег 3 %: №3 улейге қымыздық қышқылымен өңдеу қажет — 14 күннен кейінгі болжам {f3} %.',
  'demo.evening.bloom.title': 'GDD бойынша гүлдеу',
  'demo.evening.bloom.text':
    'Тиімді температура жиынтығы {need} ішінен {cur} — {name} шамамен {d} күннен кейін гүлдейді (табалдырықтың {pct} %-ы жетті). Гүлдеу басталмай тұрып улей көлемін тексеріңіз.',
  'demo.evening.weather.title': 'Ертеңгі ұшу терезесі',
  'demo.evening.weather.text':
    'Болжам бойынша ашық, +24 °C дейін, жел 3 м/с дейін, жауын-шашын 10 % — ұшу жағдайлары жақсы. Қарауларды фуражирлерге кедергі болмайтындай 11:00-ге дейін немесе 17:00-ден кейін өткізген дұрыс.',
  'demo.evening.done.title': 'Агент предписаниелері',
  'demo.evening.done.text': 'Тәулікте орындалған предписаниелер: {n}. Улей индекстері орындалған әрекеттерді ескеріп қайта есептелді.',
  'demo.evening.doneNone.title': 'Агент предписаниелері',
  'demo.evening.doneNone.text': 'Тәулікте орындалған предписание жоқ — предписание карточкасын ашып, әрекетті белгілеу үшін «Орындау» түймесін басыңыз.',

  // ── Графиктер, бірліктер, әртүрлі ──
  'demo.chart.gainLabel': 'Тәуліктік алым',
  'demo.chart.nightLabel': 'Түнде',
  'demo.chart.weightLabel': 'Салмақ',
  'demo.unit.kg': 'кг',
  'demo.unit.hz': 'Гц',
  'demo.unit.beesMin': 'ара/мин',
  'demo.unit.km': 'км',
  'demo.hives.all4': '4 улей',
  'demo.agent.discussMsg': '№{n} улейдің предписаниесін талқылайық: {title}',
}

const BE: Dict = {
  // ── Пестыцыдны банэр і факты GDD ──
  'dash.pesticide.text':
    '20 ліпеня поле рапсу «Зарэчнае» апрацуюць інсектыцыдам «Каратэ Зеон» (лямбда-цыгалотрын — I клас небяспекі для пчол). Поле ў 2,4 км, вецер у бок пасекі.',
  'dash.pesticide.desc':
    'Пірэтроід «Каратэ Зеон» высоканебяспечны для пчол (I клас): рэгламент дазваляе апрацоўку вечарам пасля заходу сонца пры ветры не вышэй за 1–2 м/с. Паводле закону аб прымяненні пестыцыдаў пчаляроў апавяшчаюць за 10–5 дзён, а ўсе пасекі ў радыусе да 7 км абавязаны атрымаць паведамленне.',
  'dash.pesticide.step1':
    'Удакніце акно апрацоўкі: пірэтроіды ўжываюць пры +10…+20 °C, звычайна вечарам пасля заходу сонца пры ветры да 1–2 м/с — паспець да вылету фуражыраў.',
  'dash.pesticide.step2':
    'Варыянт «перавоз»: вывезці пасеку на 5–7 км ад поля «Зарэчнае» — за межы ахоўнай зоны лёту пчол (раздзел «Качоўка» складзе план).',
  'dash.pesticide.step4':
    'Пасля апрацоўкі: кантраляваць прылёт пчол; пры масавай гібелі сабраць пробы і паведаміць адміністрацыю раёна. Прэцэдэнт: Башкірыя, 2019 — пасля апрацоўкі рапсу загінула 40–45 тыс. пчол.',
  'dash.gdd.note.acacia': 'першы моцны ўзятак',
  'dash.gdd.note.sunflower': '13–57 кг/га, валовы збор да 60 кг',
  'dash.gdd.note.linden': 'да 800–1000 кг/га, сям’я бярэ 10–15 кг за дзень',
  'dash.gdd.note.buckwheat': '60–360 кг/га, узятак 3–7 кг за дзень',

  // ── Меданосы ──
  'demo.crop.acacia': 'Акацыя',
  'demo.crop.sunflower': 'Сланечнік',
  'demo.crop.linden': 'Ліпа',
  'demo.crop.buckwheat': 'Грэчка',

  // ── Меткі сенсараў доказаў ──
  'demo.evidence.sensor.scales': 'Разумныя вагі',
  'demo.evidence.sensor.mic': 'Акустыка',
  'demo.evidence.sensor.cam': 'Камера на лятку',
  'demo.evidence.sensor.gas': 'Газавы датчык',
  'demo.evidence.sensor.temp': 'Тэрмадатчык',
  'demo.evidence.sensor.hum': 'Гігрометр',
  'demo.evidence.sensor.gdd': 'GDD-календар',
  'demo.evidence.sensor.weather': 'Прагноз надвор’я',
  'demo.evidence.sensor.stats': 'Статыстыка апрацовак',

  // ── Меткі сенсараў (basis) ──
  'demo.basis.scales': 'Вагі',
  'demo.basis.mic': 'Акустыка',
  'demo.basis.cam': 'Камера',
  'demo.basis.temp': 'Тэрмадатчык',
  'demo.basis.gdd': 'GDD',
  'demo.basis.stats': 'Статыстыка апрацовак',
  'demo.basis.weather': 'Прагноз надвор’я',
  'demo.basis.hum': 'Гігрометр',
  'demo.basis.gas': 'Газавы датчык',

  // ── Стан паветра і трафіку ──
  'demo.voc.hot': 'Духата — сям’і не хапае аб’ёму',
  'demo.voc.mid': 'Умераная нагрузка паветрам',
  'demo.voc.ok': 'Паветра чыстае',
  'demo.traffic.high': 'Інтэнсіўны лёт',
  'demo.traffic.active': 'Актыўны лёт',
  'demo.traffic.weak': 'Лёт аслаблены',
  'demo.traffic.low': 'Лёт рэзка зніжаны',

  // ── Палі вулляў ──
  'demo.hive.0.label': 'Уся пасека',
  'demo.hive.0.scenarioHint': 'Сярэднія паказчыкі пасекі · 1 вулей з крытычнай заклешчанасцю, 1 предроевы',
  'demo.hive.0.entranceLabel': 'Лёт актыўны па пасецы',
  'demo.hive.0.acousticLabel': 'Сярэдні гул пасекі — праца на ўзятку',
  'demo.hive.0.corps': '4 вуллі · 12 карпусаў · 1 магазін',
  'demo.hive.1.label': 'Вулей №1',
  'demo.hive.1.scenarioHint': 'Індэкс 9,2 · заклешчанасць 0,8 % · стабільны ўзятак',
  'demo.hive.1.entranceLabel': 'Актыўны лёт',
  'demo.hive.1.acousticLabel': 'Роўны гул сям’і — норма',
  'demo.hive.1.corps': '3 карпусы (дадан)',
  'demo.hive.1.queenBreed': 'Карніка',
  'demo.hive.1.queenMark': 'сіняя метка',
  'demo.hive.2.label': 'Вулей №2',
  'demo.hive.2.scenarioHint': 'Індэкс 8,8 · прыбытак +480 г/сут · вільготнасць 50 % (сушка нектару)',
  'demo.hive.2.entranceLabel': 'Інтэнсіўны лёт — пік узятку',
  'demo.hive.2.acousticLabel': 'Вентыляцыя: сушка свежага нектару',
  'demo.hive.2.corps': '3 карпусы + 1 магазін (дадан)',
  'demo.hive.2.queenBreed': 'Бакфаст',
  'demo.hive.2.queenMark': 'зялёная метка',
  'demo.hive.3.label': 'Вулей №3',
  'demo.hive.3.scenarioHint': 'Індэкс 4,8 · заклешчанасць 3,6 % · рызыка вірусу дэфармацыі крыла',
  'demo.hive.3.entranceLabel': 'Лёт аслаблены (−30 % да пасекі)',
  'demo.hive.3.acousticLabel': 'Гул з нераўным тонам — сям’я трывожыцца',
  'demo.hive.3.corps': '3 карпусы (дадан)',
  'demo.hive.3.queenBreed': 'Карніка',
  'demo.hive.3.queenMark': 'жоўтая метка',
  'demo.hive.4.label': 'Вулей №4',
  'demo.hive.4.scenarioHint': 'Індэкс 5,5 · маточнікі 41 °C · спеў матак · «барада» на лятку',
  'demo.hive.4.entranceLabel': 'Згуртаванне пчал «барадой» — рызыка ройлення',
  'demo.hive.4.acousticLabel': 'Спеў матак: выхад роя праз 3–5 дзён',
  'demo.hive.4.corps': '3 карпусы (дадан)',
  'demo.hive.4.queenBreed': 'Мясная сярэднярусская',
  'demo.hive.4.queenMark': 'без меткі',

  // ── Прадпісанні: сцэнарый «Норма» ──
  'demo.finding.n1.title': 'Сям’я развіваецца штатна',
  'demo.finding.n1.summary': 'Усе шэсць груп датчыкаў у норме — працягвайце назіранне, умяшанне не патрабуецца.',
  'demo.finding.n1.urgencyNote': 'Назіраць',
  'demo.finding.n1.probability': 'Адхіленняў не выяўлена',
  'demo.finding.n1.risk':
    'Рызыкі няма: калі бягучыя паказчыкі захаваюцца, сям’я працягне нарошчваць сілу без страт. Наступная кантрольная кропка — запланаваны агляд праз 7 дзён.',
  'demo.finding.n1.action': 'Адзначыць: запланаваны агляд выкананы',
  'demo.evidence.n1.0':
    'Вагі: роўны прыбытак +0,16…+0,19 кг/сут 5 дзён запар — без правалаў і скокаў (парог цішыні ±150 г адсякае вецер і дождж).',
  'demo.evidence.n1.1': 'Тэрмадатчык: 35,0 °C у расплоднай частцы — тэмпература пастаянная, як і належыць (норма). Перыферыя на 1–2 °C ніжэй, кармавая частка ≈ 30 °C.',
  'demo.evidence.n1.2': 'Акустыка: роўны гул 215 Гц — сям’я спакойная, ні вентыляцыі, ні спеву матак.',
  'demo.evidence.n1.3': 'Камера на лятку: 0 клешчаў на спінках за змену, трафік 42 пчалы/мін — лёт паўнавартасны.',

  'demo.finding.n2.title': 'Час паставіць магазинную надстаўку',
  'demo.finding.n2.summary': 'Свабодных сотаў засталося менш за дзве рамкі — сям’я хутка ўпрэцца ў столік аб’ёму.',
  'demo.finding.n2.urgencyNote': 'Цягам тыдня',
  'demo.finding.n2.probability': 'Імавернасць недастатковасці сотаў — 82 %',
  'demo.finding.n2.risk':
    'Праз 5–8 дзён усе соты займду мёд і расплод: сям’я абмежавіць матку ў яйцакладцы, тэмп медазбору ўпадзе на 20–30 %, а цесната падштурхне да ройлення.',
  'demo.finding.n2.action': 'Пашырыць гняздо / паставіць магазіны',
  'demo.evidence.n2.0':
    'Вагі: +0,17 кг/сут стабільна — сям’я прыносіць нектар кожны дзень і заняла пад мёд амаль увесь верхні корпус.',
  'demo.evidence.n2.1':
    'Камера: прынос пылку ў 6 з 10 вернувшыхся пчал — моцны ўзятак працягнецца, аб’ём спатрэбіцца ўжо праз 3–4 дні.',
  'demo.evidence.n2.2': 'GDD-календар: сума тэмператур дасягнула парога кветання акацыі — прыток нектару ўзмоцніцца.',

  'demo.finding.n3.title': 'Заклешчанасць у норме — лячэння не патрабуецца',
  'demo.finding.n3.summary': '0,8 % — удвая ніжэй за парог рызыкі. Хімія цяпер толькі патурбуе сям’ю на ўзятку.',
  'demo.finding.n3.urgencyNote': 'Назіраць',
  'demo.finding.n3.probability': 'Прагноз +14 дзён: 0,9 % — па-ранейшаму норма',
  'demo.finding.n3.risk':
    'Без новых апрацовак да верасня заклешчанасць дасягне ~1,3 % — застаецца ў бяспечнай зоне. Рызыка вірусу дэфармацыі крыла мінімальная.',
  'demo.finding.n3.action': 'Запланаваць кантрольны падлік праз 14 дзён',
  'demo.evidence.n3.0': 'Камера: 0 клешчаў на спінках пчал за змену назірання (да 3 за дзень лічылася б трывожным).',
  'demo.evidence.n3.1':
    'Графік заклешчанасці: пасля чэрвеньскай апрацоўкі шчаўевай кіслатой паказчык трымаецца 0,7–0,8 % ужо 12 дзён — апрацоўка працавала.',
  'demo.evidence.n3.2': 'Вагі даюць устойлівы прыбытак — сям’я моцная, аслаблення ад клешча няма.',

  'demo.finding.n4.title': 'Заўтра выдатнае акно лёту',
  'demo.finding.n4.summary': 'Да +24 °C, вецер да 3 м/с, ападкі 10 % — максимум вылету фуражыраў, агляды лепш не планаваць.',
  'demo.finding.n4.urgencyNote': 'Выкарыстаць акно лёту',
  'demo.finding.n4.probability': 'Паводле прагнозу на 10 дзён',
  'demo.finding.n4.risk':
    'Прапуск акна не небяспечны, але страціцца 1 дзень ўзятку: пры прыбытку +180 г/сут гэта ~0,2 кг мёду толькі з аднаго вулля.',
  'demo.finding.n4.action': 'Адзначыць: агляд адкладзены на паслязаўтра',
  'demo.evidence.n4.0': 'Прагноз: заўтра ясна да +24 °C, вецер 3 м/с, імавернасць ападкаў 10 % — лётныя ўмовы «добрыя».',
  'demo.evidence.n4.1': 'Вагі: ранішні скід −1,1 кг і хуткае аднаўленне да вечара — фуражыры працуюць поўны дзень.',

  // ── Прадпісанні: сцэнарый «Актыўны медазбор» ──
  'demo.finding.f1.title': 'Актыўны медазбор — сям’я працуе на ліпу',
  'demo.finding.f1.summary': 'Прыбытак +480 г/сут, сям’я перайшла ў рэжым сушкі нектару. Пора даць аб’ём пад свежы мёд.',
  'demo.finding.f1.urgencyNote': 'Сёння',
  'demo.finding.f1.probability': 'Імавернасць устойлівага ўзятку — 91 %',
  'demo.finding.f1.risk':
    'Праз 3–5 дзён з такім тэмпам соты запоўняцца: без дадатковага аб’ёму сям’я абмежавіць матку, а нектар пачне паволі траяць вільгаць — рызыка закісання пры змене надвор’я.',
  'demo.finding.f1.action': 'Пашырыць гняздо / паставіць магазіны',
  'demo.evidence.f1.0':
    'Вагі: прыбытак +460…+480 г/сут 3 дні запар — заўважна вышэй за парог цішыні ±150 г, гэта не вецер і не вільгаць.',
  'demo.evidence.f1.1':
    'Гігрометр: вільготнасць расплоднай часткі на верхняй мяжы нормы — 50 % (норма 40–50 %) пры сухім надвор’і знешкі (52 %) — сям’я заліла соты свежым нектарам і ўключыла сушку.',
  'demo.evidence.f1.2': 'Акустыка: гул змясціўся на 265 Гц — сям’я ўключыла вентыляцыю для сушкі нектару.',
  'demo.evidence.f1.3':
    'GDD-календар: сума эфектыўных тэмператур дасягнула парога кветання ліпы (да 1000 кг/га) — крыніца медазбору пацверджана; на піку ліпа дае моцнай сям’і 10–15 кг за дзень.',

  'demo.finding.f2.title': 'Апрацоўку ад клешча на ўзятку — не праводзіць',
  'demo.finding.f2.summary': 'Вагі паказваюць таварны прыбытак: любыя акарыцыды цяпер псуюць мёд. Заклешчанасць 1,4 % — час пачакаць.',
  'demo.finding.f2.urgencyNote': 'Трымаць паўзу',
  'demo.finding.f2.probability': 'Рызыка псавання таварнага мёду — высокі',
  'demo.finding.f2.risk':
    'Калі апрацаваць цяпер: мёд з рэшткамі акарыцыду нельга прадаваць, а сям’я на піку працы атрымае стрэс і страціць 2–3 дні прадукцыйнасці. Адкладзеная апрацоўка пасля адпампоўкі нічога не страчвае: заклешчанасць дойдзе максімум да 1,8 % — па-ранейшаму ніжэй за парог.',
  'demo.finding.f2.action': 'Адзначыць: апрацоўка адкладзена да адпампоўкі мёду',
  'demo.evidence.f2.0': 'Вагі: +480 г/сут — ідзе набор таварнага мёду, любыя апрацоўкі амитразам пакінуць след у прадукце.',
  'demo.evidence.f2.1': 'Камера: 1 клешч на спінках за змену — заклешчанасць 1,4 %, ніжэй за парог рызыкі 2 %.',
  'demo.evidence.f2.2': 'GDD-календар: кветанне ліпы толькі пачалося — медазбор працягнецца яшчэ 10–14 дзён.',

  'demo.finding.f3.title': 'Свежы нектар: сачыць за вільготнасцю',
  'demo.finding.f3.summary': '50 % вільготнасці — верхняя мяжа нормы (40–50 %): сям’я сушыць нектар. Патрэбна вентыляцыя, каб мёд не пачаў брадзіць.',
  'demo.finding.f3.urgencyNote': 'Цягам тыдня',
  'demo.finding.f3.probability': 'Кантроль паказчыка',
  'demo.finding.f3.risk':
    'Пры зацяжных дажджах выпарэнне спыніцца: няспелы мёд з вадой вышэй за 19–20 % пачынае брадзіць і псуецца проста ў сотах. Сям’я страціць частку таварнага мёду.',
  'demo.finding.f3.action': 'Прыадкрыць лятку / узмацніць вентыляцыю',
  'demo.evidence.f3.0': 'Гігрометр: 50 % — верхняя мяжа нормы 40–50 % для расплоднай часткі; свежы нектар у магазінах патрабуе актыўнай сушкі.',
  'demo.evidence.f3.1': 'Акустыка 265 Гц — «працоўная» частата вентылявання: сям’я ўжо сушыць нектар поўным сілай.',
  'demo.evidence.f3.2': 'CO₂ 780 ppm — узмоцненае дыханне і выпарэнне, лятка пры гэтым свабоднае.',

  'demo.finding.f4.title': 'Ранішні скід −1,4 кг — гэта фуражыры, не страта',
  'demo.finding.f4.summary': 'Вага падае раніцай і аднаўляецца да вечара з прыбыткам — класічная крывая вылету за ўзяткам.',
  'demo.finding.f4.urgencyNote': 'Назіраць',
  'demo.finding.f4.probability': 'Хібных спрацоўванняў няма',
  'demo.finding.f4.risk':
    'Рызыкі няма: гэта нармальная крывая дня. Фільтр «парог цішыні ±150 г» ужо адсякае дробныя ваганні ад ветру і крапель дожджу, таму хібных трывог не будзе.',
  'demo.finding.f4.action': 'Адзначыць: скід вагі пацверджаны як норма',
  'demo.evidence.f4.0': 'Вагі: з 6:40 да 8:20 скід −1,4 кг (вылет ~1400 фуражыраў), да 20:00 вага вышэй за ранішнюю на +0,48 кг.',
  'demo.evidence.f4.1': 'Камера: пік вылету 08:00–11:00 — 68 пчал/мін, люстэркова супадае з правалам вагі.',
  'demo.evidence.f4.2': 'Надвор’е сухое, вецер да 3 м/с — скід не звязаны з ападкамі або абрывам птушкамі.',

  // ── Прадпісанні: сцэнарый «Успышка заклешчанасці» ──
  'demo.finding.v1.title': 'Крытычная заклешчанасць 3,6 % — высокі рызыка вірусу дэфармацыі крыла',
  'demo.finding.v1.summary': '3,6 % — вышэй за парог 3 %. Без апрацоўкі сям’я заразіцца вірусам дэфармацыі крыла і аслабнее да зімавання.',
  'demo.finding.v1.urgencyNote': 'Дзейнічаць цяпер',
  'demo.finding.v1.probability': 'Імавернасць шкоднай нагрузкі — 94 %',
  'demo.finding.v1.risk':
    'Праз 14 дзён заклешчанасць перавысіць 5 %: вірус дэфармацыі крыла (DWV) пераходзіць у расплод — крылы маладых пчал робяцца «скляначкамі», сям’я траціць 30–50 % сілы за 2–3 месяцы і пойдзе ў зімаванне аслабленай. Пры 5 % і вышэй зімаванне часцей за ўсё гібельнае.',
  'demo.finding.v1.action': 'Правесці біо-апрацоўку шчаўевай кіслатой',
  'demo.evidence.v1.0':
    'Камера на лятку: 7 пчал з клешчамі на спінках за змену — пры трафіку 31 пчала/мін гэта экстрапаляцыя ў 3,4–3,7 % заклешчанасці.',
  'demo.evidence.v1.1':
    'Графік заклешчанасці: рост тры тыдні запар (+0,9 %/тыдзень), прагноз праз 14 дзён — 5,2 %. Трихлорметазід-апрацоўка ў чэрвені эфекту не дала (дып не выражаны).',
  'demo.evidence.v1.2':
    'Крос-праверка: у суседніх вулляў №1 і №2 паказчык 0,8–1,4 % — крыніца заражэння лакальная, гэта менавіта вулей №3, а не ўся пасека.',
  'demo.evidence.v1.3': 'Камера: каля лятку заўважаны 2 пчалы з дэфармаванымі крыламі — першыя носьбіты DWV ужо з’явіліся.',

  'demo.finding.v2.title': 'Праверыць расплод на вірус дэфармацыі крыла (DWV)',
  'demo.finding.v2.summary': 'Пчалы з «скляначкамі» крылаў каля лятку — вирус ужо ў сям’і. Патрэбны візуальны агляд рамак з расплодам.',
  'demo.finding.v2.urgencyNote': 'Аглядаваць сёння',
  'demo.finding.v2.probability': 'Імавернасць DWV — 68 %',
  'demo.finding.v2.risk':
    'Праз 7–10 дзён вирус пакры ўвесь расплод: выхад маладога пакалення з дэфектнымі крыламі, сям’я не нарасціць пчалу да зімавання. Ізаляваць матку і лячыць трэба да сярэдзіны цыкла расплода.',
  'demo.finding.v2.action': 'Аглядаваць расплод і далучыць фота да справаздачы',
  'demo.evidence.v2.0': 'Камера: 2 пчалы з дэфармаванымі крыламі за дзень каля лятку — хворыя першымі трацяць здольнасць да палёту.',
  'demo.evidence.v2.1': 'Заклешчанасць 3,6 %: клешч — асноўны пераносчык DWV, пры паказчыку вышэй за 3 % вирус праяўляецца амаль заўсёды.',
  'demo.evidence.v2.2': 'Трафік 31 пчала/мін (−30 % да пасекі) — частка маладых пчал ужо не вылятае на працу.',

  'demo.finding.v3.title': 'Слабы трафік на лятку — сям’я траціць тэмп',
  'demo.finding.v3.summary': '31 пчала/мін супраць 45 у сярэднім па пасецы: клешч аслабляе лётных пчал, прыбытак падае.',
  'demo.finding.v3.urgencyNote': 'Цягам тыдня',
  'demo.finding.v3.probability': 'Сувязь з заклешчанасцю — 71 %',
  'demo.finding.v3.risk':
    'Праз 3–14 дзён разрыў па прыбытку павялічыцца: сям’я збярэ на 30–40 % менш мёду да канца сезона, а аслабленыя пчалы горш зімуюць.',
  'demo.finding.v3.action': 'Адзначыць: узмоцнены кантроль трафіку на 7 дзён',
  'demo.evidence.v3.0': 'Камера: 31 пчала/мін — на 30 % ніжэй за сярэдняе па пасецы пры аднолькавым надвор’і для ўсіх вулляў.',
  'demo.evidence.v3.1': 'Вагі: прыбытак усяго +0,12 кг/сут супраць +0,17 кг у вулля №1 — розніца прыкладна роўная страце лётных пчал.',
  'demo.evidence.v3.2': 'Надвор’е для ўсіх вулляў адно — фактар надвор’я выключае прычыну падзення лёту.',

  'demo.finding.v4.title': 'Апрацоўка шчаўевай кіслатой не нашкодзіць ўзятку',
  'demo.finding.v4.summary': 'Прыбытак вулля сціплы (+120 г/сут), таварнага патоку няма — шчаўевая кіслата бяспечная проста цяпер.',
  'demo.finding.v4.urgencyNote': 'Запланаваць',
  'demo.finding.v4.probability': 'Сумяшчальнасць з ўзяткам — пацверджана',
  'demo.finding.v4.risk':
    'Зацягванне апрацоўкі небяспечнейшае за самае лячэнне: кожныя 7 дзён затрымкі дадаюць ~0,9 % заклешчанасці і павышаюць рызыку DWV у зімуючых пчал.',
  'demo.finding.v4.action': 'Запланаваць апрацоўку на заўтра 7:00',
  'demo.evidence.v4.0': 'Вагі: +0,12 кг/сут — ніжэй за парог цішыні таварнага набору, магазіннага мёду ў сотах дадаюцца паволі.',
  'demo.evidence.v4.1': 'GDD-календар: асноўны ўзятак (ліпа) сям’я амаль не выкарыстоўвае з-за слабага лёту — страты ад апрацоўкі мінімальныя.',
  'demo.evidence.v4.2': 'Шчаўевая кіслата — біо-метад: дапушчальная пры слабым ўзятку, не пакідае следаў у таварным мёды (у адрозненне ад амитразу).',

  // ── Прадпісанні: сцэнарый «Предроевы стан» ──
  'demo.finding.s1.title': 'Спеў матак — рой выйдзе праз 3–5 дзён',
  'demo.finding.s1.summary': 'Акустыка зафіксавала 390 Гц, лятка ў «барадзе», вылет упаў на 40 %. Сям’я гатова да дзялення.',
  'demo.finding.s1.urgencyNote': 'Дзейнічаць цяпер',
  'demo.finding.s1.probability': 'Імавернасць выхаду роя — 85 %',
  'demo.finding.s1.risk':
    'Праз 3–5 дзён з першым добрым днём рой палеткіць: сям’я страціць да 40 % масы і адзіны працоўны паток на 2–3 тыдні, вулей №4 збярэ ўдвая менш мёду. Паймаць выйшаўшы рой атрымліваецца не заўсёды.',
  'demo.finding.s1.action': 'Аглядаваць маточнікі',
  'demo.evidence.s1.0': 'Акустыка: 390 Гц — «спеў» матак (маточнікі спеюць, маладыя маткі пераклікаюцца). Нармальны гул сям’і — 215 Гц.',
  'demo.evidence.s1.1': 'Камера: вылет зніжаны на 40 % і ўтварылася «барада» з пчал на лятку — пчалы-«грэлкі» выйшлі з вулля з-за духоты.',
  'demo.evidence.s1.2': 'CO₂ вырас да 1450 ppm з-за скучанасці (норма да 800) — вулей перапоўнены.',
  'demo.evidence.s1.3': 'Тэрмадатчык: расплодная частка стабільная — 35,0 °C, але ў зоне маточнікаў (будова сотаў) пчалы паднялі тэмпературу да 41 °C — сям’я грэе вялікі аб’ём свежай будовы.',

  'demo.finding.s2.title': 'Духата ў вуллі — пашырыць аб’ём і вентыляцыю',
  'demo.finding.s2.summary': 'CO₂ 1450 ppm пры «барадзе» на лятку: сям’і фізічна не хапае аб’ёму і паветра.',
  'demo.finding.s2.urgencyNote': 'Сёння',
  'demo.finding.s2.probability': 'Прычына духаты — скучанасць',
  'demo.finding.s2.risk':
    'Праз 3–7 дзён перагрэў расплода (вышэй за 36 °C) выкліча гібель часткі друкаванага расплода, а духата паскорыць ройленне — сям’і камфортней палеткіць, чым цярпець.',
  'demo.finding.s2.action': 'Прыбраць дыяфрагму / пашырыць гняздо',
  'demo.evidence.s2.0': 'CO₂ 1450 ppm — удвая вышэй за працоўную норму 600–800 ppm; індэкс ЛОС 87 — паветра ў вуллі «цяжкае».',
  'demo.evidence.s2.1': 'Вільготнасць 56 % — вышэй за норму расплоднай часткі (40–50 %), вільгаць не выпараецца: вентыляцыя не справляецца.',
  'demo.evidence.s2.2': '«Барада» на лятку — сотні пчал вісяць звонку, бо ўнутры няма месца.',

  'demo.finding.s3.title': 'Зрабіць штучнае дзяленне (адводак)',
  'demo.finding.s3.summary': 'Класічны прыём: адвесці ройвую энергію на фарміраванне новай сям’і, а не страціць яе ў паветры.',
  'demo.finding.s3.urgencyNote': 'Сёння да вечара',
  'demo.finding.s3.probability': 'Эфект правераны практыкай',
  'demo.finding.s3.risk':
    'Калі даць сям’і адроіцца самай: рой з неплоднай маткай можа палеткіць на 5–10 км, старая сям’я застанецца без лётных пчал на 3 тыдні. Кантраляваны адводак захоўвае абедзве часткі сям’і.',
  'demo.finding.s3.action': 'Зрабіць адводак на 3 рамках расплода',
  'demo.evidence.s3.0': 'Акустыка 390 Гц — маточнікі ўжо спеюць: сям’я «ўзяла курс» на ройленне, адмена яго адным пашырэннем не гарантавана.',
  'demo.evidence.s3.1': 'Вагі: прыбытак амаль спыніўся (+0,05 кг/сут) — сям’я не будзе і не збірае, ўся энергія ў падрыхтоўцы роя.',
  'demo.evidence.s3.2': 'Сіла сям’і высокая (ранішні скід −1,4 кг у звычайныя дні) — адводак на 3 рамках расплода атрымаецца паўнавартасным.',

  'demo.finding.s4.title': 'Пакінуць 2 лепшыя маточнікі, астатнія вырэзаць',
  'demo.finding.s4.summary': '8 маточнікаў — перабор: кантроль колькасці маточнікаў зніжае паўторнае ройленне.',
  'demo.finding.s4.urgencyNote': 'Цягам тыдня',
  'demo.finding.s4.probability': 'Рызыка паўторнага ройлення без меры — 55 %',
  'demo.finding.s4.risk':
    'Праз 7–14 дзён пасля першага роя сям’я можа адроіцца паўторна з маладой маткай («ціхае» ройленне) — і так да поўнага аслаблення. Кантроль маточнікаў — стандартная прафілактыка.',
  'demo.finding.s4.action': 'Вырэзаць лішнія маточнікі, пакінуць 2',
  'demo.evidence.s4.0': 'Акустыка: спеў матак чуваць ужо цяпер — у сям’і спеюць некалькі матак адначасова, гэта класічная прыкмета «ціхага» паўторнага ройлення.',
  'demo.evidence.s4.1': 'Тэрмадатчык: у зоне маточнікаў 41 °C — будову сотаў пчалы грэюць да 40–42 °C; расплодная частка пры гэтым трымае пастаянныя 35,0 °C.',
  'demo.evidence.s4.2': 'Трафік зніжаны — старая матка ўжо абмежавана ў яйцакладцы, сям’я пераключылася на размнажэнне.',

  // ── Вечаровая справаздача ──
  'demo.evening.weight.title': 'Чысты прыбытак нектару',
  'demo.evening.weight.text':
    'Пасля вяртання лётных пчал пасека дадала {gain} кг за суткі. Найлепшы дзень у вулля №{bestHive} — {best} кг (сушка нектару на {hz} Гц). Ранішнія скіды фуражыраў паўсюль кампенсаваны вечаровым ростам.',
  'demo.evening.varroa.title': 'Стан заклешчанасці',
  'demo.evening.varroa.item': '№{n} — {p} % ({s})',
  'demo.evening.varroa.itemF': '№{n} — {p} % ({s}, прагноз {f} %)',
  'demo.evening.varroa.text': '{list}. Парог крытычнасці 3 %: вулей №3 патрабуе апрацоўкі шчаўевай кіслатой — прагноз праз 14 дзён {f3} %.',
  'demo.evening.bloom.title': 'Кветанне паводле GDD',
  'demo.evening.bloom.text':
    'Сума эфектыўных тэмператур {cur} з {need} — {name} зацвіце прыкладна праз {d} дзён (парог дасягнуты на {pct} %). Праверце аб’ём вулляў да пачатку кветання.',
  'demo.evening.weather.title': 'Акно лёту на заўтра',
  'demo.evening.weather.text':
    'Паводле прагнозу ясна да +24 °C, вецер да 3 м/с, ападкі 10 % — лётныя ўмовы добрыя. Агляды лепш правесці да 11:00 або пасля 17:00, каб не замінаць фуражырам.',
  'demo.evening.done.title': 'Прадпісанні агента',
  'demo.evening.done.text': 'Выканана прадпісанняў за суткі: {n}. Індэксы вулляў пералічаны з улікам выкананых дзеянняў.',
  'demo.evening.doneNone.title': 'Прадпісанні агента',
  'demo.evening.doneNone.text': 'Выкананых прадпісанняў за суткі няма — адкрыйце картку прадпісання і націсніце «Выканаць», каб адзначыць дзеянне.',

  // ── Графікі, адзінкі, рознае ──
  'demo.chart.gainLabel': 'Сутачны прыбытак',
  'demo.chart.nightLabel': 'Уначы',
  'demo.chart.weightLabel': 'Вага',
  'demo.unit.kg': 'кг',
  'demo.unit.hz': 'Гц',
  'demo.unit.beesMin': 'пчал/мін',
  'demo.unit.km': 'км',
  'demo.hives.all4': '4 вуллі',
  'demo.agent.discussMsg': 'Абмяркуем прадпісанне для вулля №{n}: {title}',
}

const ZH: Dict = {
  // ── 农药警示横幅与 GDD 事实 ──
  'dash.pesticide.text':
    '7月20日，「扎列奇诺耶」油菜田将喷洒杀虫剂「Karate Zeon」（高效氯氟氰菊酯 — 对蜜蜂毒性 I 级）。田地距离 2.4 公里，风向朝向蜂场。',
  'dash.pesticide.desc':
    '拟除虫菊酯类杀虫剂「Karate Zeon」对蜜蜂高毒（I 级）：规程允许在日落后傍晚、风速不超过 1–2 米/秒时施药。依据农药使用法规，养蜂人须在施药前 10–5 天内收到通知，7 公里半径内的所有蜂场都必须收到告知书。',
  'dash.pesticide.step1':
    '确认施药时间窗：拟除虫菊酯应在 +10…+20 °C、通常日落后傍晚、风速不超过 1–2 米/秒时施用 — 务必赶在采集蜂出勤之前完成。',
  'dash.pesticide.step2':
    '方案「搬迁」：将蜂场迁至距「扎列奇诺耶」田地 5–7 公里处 — 超出蜜蜂飞行防护区（「转地放蜂」板块会制定计划）。',
  'dash.pesticide.step4':
    '施药之后：观察蜜蜂归巢情况；若出现大量死亡，收集样本并通知区级行政部门。先例：2019 年巴什基利亚 — 油菜田施药后 4–4.5 万只蜜蜂死亡。',
  'dash.gdd.note.acacia': '第一个强流蜜期',
  'dash.gdd.note.sunflower': '13–57 公斤/公顷，总收获可达 60 公斤',
  'dash.gdd.note.linden': '最高 800–1000 公斤/公顷，单群一天可采 10–15 公斤',
  'dash.gdd.note.buckwheat': '60–360 公斤/公顷，日流蜜 3–7 公斤',

  // ── 蜜源植物 ──
  'demo.crop.acacia': '洋槐',
  'demo.crop.sunflower': '向日葵',
  'demo.crop.linden': '椴树',
  'demo.crop.buckwheat': '荞麦',

  // ── 证据传感器标签 ──
  'demo.evidence.sensor.scales': '智能秤',
  'demo.evidence.sensor.mic': '声学监测',
  'demo.evidence.sensor.cam': '巢门摄像头',
  'demo.evidence.sensor.gas': '气体传感器',
  'demo.evidence.sensor.temp': '温度传感器',
  'demo.evidence.sensor.hum': '湿度计',
  'demo.evidence.sensor.gdd': 'GDD 日历',
  'demo.evidence.sensor.weather': '天气预报',
  'demo.evidence.sensor.stats': '防治统计',

  // ── 依据传感器标签 ──
  'demo.basis.scales': '秤重',
  'demo.basis.mic': '声学',
  'demo.basis.cam': '摄像头',
  'demo.basis.temp': '温度传感器',
  'demo.basis.gdd': 'GDD',
  'demo.basis.stats': '防治统计',
  'demo.basis.weather': '天气预报',
  'demo.basis.hum': '湿度计',
  'demo.basis.gas': '气体传感器',

  // ── 空气与访问量状态 ──
  'demo.voc.hot': '闷热 — 蜂群空间不足',
  'demo.voc.mid': '空气负荷中等',
  'demo.voc.ok': '空气清新',
  'demo.traffic.high': '出入繁忙',
  'demo.traffic.active': '出入活跃',
  'demo.traffic.weak': '出勤减弱',
  'demo.traffic.low': '出勤骤降',

  // ── 蜂箱字段 ──
  'demo.hive.0.label': '整个蜂场',
  'demo.hive.0.scenarioHint': '全场平均值 · 1 箱螨害临界，1 箱分蜂前兆',
  'demo.hive.0.entranceLabel': '全场出勤活跃',
  'demo.hive.0.acousticLabel': '全场平均鸣声 — 流蜜作业中',
  'demo.hive.0.corps': '4 箱 · 12 箱体 · 1 继箱',
  'demo.hive.1.label': '1号蜂箱',
  'demo.hive.1.scenarioHint': '指数 9.2 · 螨害 0.8% · 流蜜稳定',
  'demo.hive.1.entranceLabel': '出入活跃',
  'demo.hive.1.acousticLabel': '蜂群鸣声平稳 — 正常',
  'demo.hive.1.corps': '3 箱体（达旦箱）',
  'demo.hive.1.queenBreed': '卡尼鄂拉',
  'demo.hive.1.queenMark': '蓝色标记',
  'demo.hive.2.label': '2号蜂箱',
  'demo.hive.2.scenarioHint': '指数 8.8 · 日增 +480 克 · 湿度 50%（风干花蜜）',
  'demo.hive.2.entranceLabel': '出入繁忙 — 流蜜高峰',
  'demo.hive.2.acousticLabel': '通风中：风干新鲜花蜜',
  'demo.hive.2.corps': '3 箱体 + 1 继箱（达旦箱）',
  'demo.hive.2.queenBreed': '巴克快',
  'demo.hive.2.queenMark': '绿色标记',
  'demo.hive.3.label': '3号蜂箱',
  'demo.hive.3.scenarioHint': '指数 4.8 · 螨害 3.6% · 畸形翅病毒风险',
  'demo.hive.3.entranceLabel': '出勤减弱（较全场 −30%）',
  'demo.hive.3.acousticLabel': '鸣声不匀 — 蜂群躁动不安',
  'demo.hive.3.corps': '3 箱体（达旦箱）',
  'demo.hive.3.queenBreed': '卡尼鄂拉',
  'demo.hive.3.queenMark': '黄色标记',
  'demo.hive.4.label': '4号蜂箱',
  'demo.hive.4.scenarioHint': '指数 5.5 · 王台 41 °C · 蜂王鸣唱 · 巢门「蜂胡须」',
  'demo.hive.4.entranceLabel': '蜜蜂结「蜂胡须」聚集 — 分蜂风险',
  'demo.hive.4.acousticLabel': '蜂王鸣唱：分蜂群 3–5 天内飞出',
  'demo.hive.4.corps': '3 箱体（达旦箱）',
  'demo.hive.4.queenBreed': '本地中俄罗斯种',
  'demo.hive.4.queenMark': '无标记',

  // ── 处方建议：场景「正常」 ──
  'demo.finding.n1.title': '蜂群正常发展',
  'demo.finding.n1.summary': '六组传感器全部正常 — 继续观察，无需干预。',
  'demo.finding.n1.urgencyNote': '观察',
  'demo.finding.n1.probability': '未发现异常',
  'demo.finding.n1.risk': '无风险：若当前指标保持，蜂群将继续无损地壮大。下一个检查点为 7 天后的例行检查。',
  'demo.finding.n1.action': '标记：例行检查已完成',
  'demo.evidence.n1.0': '秤重：连续 5 天平稳日增 +0.16…+0.19 公斤 — 无骤降和骤升（±150 克静默阈值过滤了风和雨）。',
  'demo.evidence.n1.1': '温度传感器：子脾区 35.0 °C — 温度恒定，正如应有水平（正常）。外围低 1–2 °C，饲料区 ≈ 30 °C。',
  'demo.evidence.n1.2': '声学：215 赫兹平稳鸣声 — 蜂群安静，既没有通风也没有蜂王鸣唱。',
  'demo.evidence.n1.3': '巢门摄像头：整班背部螨数为 0，访问量 42 只/分 — 出勤完全正常。',

  'demo.finding.n2.title': '该加继箱了',
  'demo.finding.n2.summary': '空巢脾已不足两张 — 蜂群很快将面临空间不足。',
  'demo.finding.n2.urgencyNote': '一周内',
  'demo.finding.n2.probability': '巢脾不足概率 — 82%',
  'demo.finding.n2.risk': '5–8 天后所有巢脾将被蜂蜜和子脾占满：蜂群会限制蜂王产卵，采蜜速度下降 20–30%，拥挤还会诱发分蜂。',
  'demo.finding.n2.action': '扩巢 / 加继箱',
  'demo.evidence.n2.0': '秤重：稳定 +0.17 公斤/天 — 蜂群每天采回花蜜，蜜几乎占满整个上层箱体。',
  'demo.evidence.n2.1': '摄像头：每 10 只归巢蜂中有 6 只携带花粉 — 强流蜜将持续，3–4 天后就需要扩容。',
  'demo.evidence.n2.2': 'GDD 日历：有效积温已达洋槐开花阈值 — 花蜜进账将增强。',

  'demo.finding.n3.title': '螨害正常 — 无需治疗',
  'demo.finding.n3.summary': '0.8% — 仅为风险阈值的一半。此时用药只会干扰流蜜中的蜂群。',
  'demo.finding.n3.urgencyNote': '观察',
  'demo.finding.n3.probability': '预测 +14 天：0.9% — 仍属正常',
  'demo.finding.n3.risk': '若不再防治，到九月螨害将达 ~1.3% — 仍在安全区。畸形翅病毒风险极低。',
  'demo.finding.n3.action': '安排 14 天后复查计数',
  'demo.evidence.n3.0': '摄像头：观察班次内蜂背螨数为 0（每天 3 只就会令人担忧）。',
  'demo.evidence.n3.1': '螨害曲线：六月草酸防治后，指标已连续 12 天保持在 0.7–0.8% — 防治见效。',
  'demo.evidence.n3.2': '秤重显示稳定增重 — 蜂群强壮，未因螨害而衰弱。',

  'demo.finding.n4.title': '明天是极佳的飞行窗口',
  'demo.finding.n4.summary': '最高 +24 °C，风速 3 米/秒，降水概率 10% — 采集蜂出勤最多，最好不安排检查。',
  'demo.finding.n4.urgencyNote': '利用飞行窗口',
  'demo.finding.n4.probability': '基于 10 天预报',
  'demo.finding.n4.risk': '错过窗口并无危险，但会损失 1 天流蜜：按日增 +180 克计，单箱约损失 0.2 公斤蜂蜜。',
  'demo.finding.n4.action': '标记：检查推迟到后天',
  'demo.evidence.n4.0': '预报：明天晴，最高 +24 °C，风速 3 米/秒，降水概率 10% — 飞行条件「良好」。',
  'demo.evidence.n4.1': '秤重：清晨下降 −1.1 公斤并于傍晚迅速回升 — 采集蜂全天工作。',

  // ── 处方建议：场景「活跃流蜜」 ──
  'demo.finding.f1.title': '流蜜活跃 — 蜂群正在采椴树蜜',
  'demo.finding.f1.summary': '日增 +480 克，蜂群已转入风干花蜜模式。该为新鲜蜂蜜腾出空间了。',
  'demo.finding.f1.urgencyNote': '今天',
  'demo.finding.f1.probability': '持续流蜜概率 — 91%',
  'demo.finding.f1.risk': '照此速度 3–5 天巢脾将装满：缺少扩容蜂群会限制蜂王产卵，花蜜失水缓慢 — 天气变化时有发酵酸败风险。',
  'demo.finding.f1.action': '扩巢 / 加继箱',
  'demo.evidence.f1.0': '秤重：连续 3 天日增 +460…+480 克 — 明显高于 ±150 克静默阈值，不是风也不是湿气。',
  'demo.evidence.f1.1': '湿度计：子脾区湿度处于正常上限 — 50%（正常 40–50%），室外干燥（52%）— 蜂群刚把巢脾灌满新鲜花蜜并开启风干模式。',
  'demo.evidence.f1.2': '声学：鸣声移至 265 赫兹 — 蜂群已开启通风以风干花蜜。',
  'demo.evidence.f1.3': 'GDD 日历：有效积温已达椴树开花阈值（最高 1000 公斤/公顷）— 流蜜源已确认；盛花期强群一天可采 10–15 公斤。',

  'demo.finding.f2.title': '流蜜期不做螨害防治',
  'demo.finding.f2.summary': '秤重显示商品蜜增重：此时任何杀螨剂都会污染蜂蜜。螨害 1.4% — 应当等待。',
  'demo.finding.f2.urgencyNote': '保持暂停',
  'demo.finding.f2.probability': '商品蜜变质风险 — 高',
  'demo.finding.f2.risk': '若现在防治：含杀螨剂残留的蜂蜜不可出售，处于工作高峰的蜂群会受应激并损失 2–3 天产能。推迟到取蜜后再防治毫无损失：螨害最多升到 1.8% — 仍低于阈值。',
  'demo.finding.f2.action': '标记：防治推迟到取蜜后',
  'demo.evidence.f2.0': '秤重：+480 克/天 — 正在积累商品蜜，任何双甲脒防治都会在产品中留下残留。',
  'demo.evidence.f2.1': '摄像头：整班蜂背螨数 1 — 螨害 1.4%，低于 2% 风险阈值。',
  'demo.evidence.f2.2': 'GDD 日历：椴树开花才刚刚开始 — 流蜜还将持续 10–14 天。',

  'demo.finding.f3.title': '新鲜花蜜：注意湿度',
  'demo.finding.f3.summary': '湿度 50% — 正常上限（40–50%）：蜂群正在风干花蜜。需要通风以防蜂蜜开始发酵。',
  'demo.finding.f3.urgencyNote': '一周内',
  'demo.finding.f3.probability': '监控指标',
  'demo.finding.f3.risk': '连绵阴雨时蒸发停止：含水量超过 19–20% 的未成熟蜜会开始发酵并直接在巢脾中变质。蜂群将损失部分商品蜜。',
  'demo.finding.f3.action': '稍微打开巢门 / 加强通风',
  'demo.evidence.f3.0': '湿度计：50% — 子脾区 40–50% 正常区间的上限；继箱中的新鲜花蜜需要积极风干。',
  'demo.evidence.f3.1': '声学 265 赫兹 — 通风的「工作」频率：蜂群已全速风干花蜜。',
  'demo.evidence.f3.2': 'CO₂ 780 ppm — 呼吸与蒸发增强，巢门仍保持畅通。',

  'demo.finding.f4.title': '清晨下降 −1.4 公斤 — 是采集蜂出勤，并非损失',
  'demo.finding.f4.summary': '重量清晨下降、傍晚带盈余回升 — 典型的采集出勤曲线。',
  'demo.finding.f4.urgencyNote': '观察',
  'demo.finding.f4.probability': '无误报',
  'demo.finding.f4.risk': '无风险：这是正常的日间曲线。「±150 克静默阈值」过滤器已滤除风和雨滴造成的微小波动，因此不会误报。',
  'demo.finding.f4.action': '标记：重量下降已确认为正常',
  'demo.evidence.f4.0': '秤重：6:40 至 8:20 下降 −1.4 公斤（约 1400 只采集蜂出勤），至 20:00 重量高于清晨 +0.48 公斤。',
  'demo.evidence.f4.1': '摄像头：出勤高峰 08:00–11:00 — 68 只/分，与重量低谷恰好镜像对应。',
  'demo.evidence.f4.2': '天气干燥，风速 3 米/秒 — 该下降与降水或鸟类掠夺无关。',

  // ── 处方建议：场景「螨害爆发」 ──
  'demo.finding.v1.title': '螨害临界 3.6% — 畸形翅病毒高风险',
  'demo.finding.v1.summary': '3.6% — 已超过 3% 阈值。若不防治，蜂群将感染畸形翅病毒，越冬前衰弱。',
  'demo.finding.v1.urgencyNote': '立即行动',
  'demo.finding.v1.probability': '致害负荷概率 — 94%',
  'demo.finding.v1.risk': '14 天后螨害将超过 5%：畸形翅病毒（DWV）会侵入子脾 — 幼蜂翅膀变得像「小玻璃片」，蜂群在 2–3 个月内损失 30–50% 群势，越冬时衰弱。螨害达 5% 及以上时越冬多半是致命的。',
  'demo.finding.v1.action': '实施草酸生物防治',
  'demo.evidence.v1.0': '巢门摄像头：整班 7 只蜂背带螨 — 按访问量 31 只/分推算，螨害为 3.4–3.7%。',
  'demo.evidence.v1.1': '螨害曲线：连续三周上升（+0.9%/周），14 天预测为 5.2%。六月的 Trichlormetazide 防治无效（无明显低谷）。',
  'demo.evidence.v1.2': '交叉验证：相邻 1、2 号箱指标为 0.8–1.4% — 感染源是局部的，正是 3 号箱，而非整个蜂场。',
  'demo.evidence.v1.3': '摄像头：巢门口发现 2 只翅形畸形的蜜蜂 — 首批 DWV 携带者已出现。',

  'demo.finding.v2.title': '检查子脾是否感染畸形翅病毒（DWV）',
  'demo.finding.v2.summary': '巢门口出现「玻璃翅」蜜蜂 — 病毒已在蜂群中。需目视检查子脾框。',
  'demo.finding.v2.urgencyNote': '今日检查',
  'demo.finding.v2.probability': 'DWV 概率 — 68%',
  'demo.finding.v2.risk': '7–10 天后病毒将覆盖全部子脾：新一代出房即翅缺陷，蜂群无法为越冬培育新蜂。须在子脾周期过半前隔离蜂王并治疗。',
  'demo.finding.v2.action': '检查子脾并将照片附到报告中',
  'demo.evidence.v2.0': '摄像头：一天内巢门口 2 只翅形畸形蜂 — 患病蜂最先丧失飞行能力。',
  'demo.evidence.v2.1': '螨害 3.6%：螨是 DWV 的主要传播媒介，指标高于 3% 时病毒几乎总会显现。',
  'demo.evidence.v2.2': '访问量 31 只/分（较全场 −30%）— 部分幼蜂已不再出勤。',

  'demo.finding.v3.title': '巢门访问量偏低 — 蜂群节奏放缓',
  'demo.finding.v3.summary': '31 只/分，低于全场均值 45：螨害削弱飞行蜂，增重下滑。',
  'demo.finding.v3.urgencyNote': '一周内',
  'demo.finding.v3.probability': '与螨害的关联 — 71%',
  'demo.finding.v3.risk': '3–14 天后增重差距将扩大：到季末该群蜂蜜收获量少 30–40%，且衰弱蜂群越冬更差。',
  'demo.finding.v3.action': '标记：连续 7 天加强访问量监测',
  'demo.evidence.v3.0': '摄像头：31 只/分 — 在各箱天气相同的情况下低于全场均值 30%。',
  'demo.evidence.v3.1': '秤重：日增仅 +0.12 公斤，而 1 号箱为 +0.17 公斤 — 差值大致等于飞行蜂的损失。',
  'demo.evidence.v3.2': '各箱天气一致 — 可排除天气作为出勤下降的原因。',

  'demo.finding.v4.title': '草酸防治不会影响流蜜',
  'demo.finding.v4.summary': '该箱增重不高（+120 克/天），无商品蜜流 — 此时草酸防治安全。',
  'demo.finding.v4.urgencyNote': '安排',
  'demo.finding.v4.probability': '与流蜜的兼容性 — 已确认',
  'demo.finding.v4.risk': '拖延防治比治疗本身更危险：每拖延 7 天，螨害约增加 0.9%，并推高越冬蜂的 DWV 风险。',
  'demo.finding.v4.action': '将防治安排在明天 7:00',
  'demo.evidence.v4.0': '秤重：+0.12 公斤/天 — 低于商品蜜积累的静默阈值，继箱中的蜂蜜增长缓慢。',
  'demo.evidence.v4.1': 'GDD 日历：因出勤弱，蜂群几乎无法利用主蜜源（椴树）— 防治损失极小。',
  'demo.evidence.v4.2': '草酸属于生物防治方法：弱流蜜期可用，且不在商品蜜中留下残留（与双甲脒不同）。',

  // ── 处方建议：场景「分蜂前兆」 ──
  'demo.finding.s1.title': '蜂王鸣唱 — 分蜂群将在 3–5 天内飞出',
  'demo.finding.s1.summary': '声学记录到 390 赫兹，巢门出现「蜂胡须」，出勤下降 40%。蜂群已准备好分蜂。',
  'demo.finding.s1.urgencyNote': '立即行动',
  'demo.finding.s1.probability': '分蜂群飞出概率 — 85%',
  'demo.finding.s1.risk': '3–5 天后遇第一个好天气分蜂群就会飞走：蜂群将损失至多 40% 的体量和此后 2–3 周唯一的采蜜流；4 号箱蜂蜜将减半。飞出的分蜂群并非总能收回。',
  'demo.finding.s1.action': '检查王台',
  'demo.evidence.s1.0': '声学：390 赫兹 — 蜂王「鸣唱」（王台成熟，处女王互相呼应）。蜂群正常鸣声为 215 赫兹。',
  'demo.evidence.s1.1': '摄像头：出勤下降 40%，巢门结成蜜蜂「蜂胡须」— 因闷热「保温蜂」已离开蜂箱。',
  'demo.evidence.s1.2': '因拥挤 CO₂ 升至 1450 ppm（正常上限 800）— 蜂箱已过满。',
  'demo.evidence.s1.3': '温度传感器：子脾区稳定在 35.0 °C，但王台区（造脾区）的蜜蜂已将温度升至 41 °C — 蜂群正在为大片新造的巢脾加温。',

  'demo.finding.s2.title': '蜂箱闷热 — 扩大空间并加强通风',
  'demo.finding.s2.summary': 'CO₂ 1450 ppm 且巢门结「蜂胡须」：蜂群在空间和空气上均已不足。',
  'demo.finding.s2.urgencyNote': '今天',
  'demo.finding.s2.probability': '闷热原因 — 拥挤',
  'demo.finding.s2.risk': '3–7 天后子脾过热（超过 36 °C）将导致部分封盖子死亡，闷热还会加速分蜂 — 对蜂群而言，飞走比忍受更容易。',
  'demo.finding.s2.action': '取出隔板 / 扩巢',
  'demo.evidence.s2.0': 'CO₂ 1450 ppm — 为工作上限 600–800 ppm 的两倍；VOC 指数 87 — 箱内空气「浑浊」。',
  'demo.evidence.s2.1': '湿度 56% — 高于子脾区正常值（40–50%），水汽无法蒸发：通风已力不从心。',
  'demo.evidence.s2.2': '巢门「蜂胡须」— 数百只蜂挂在箱外，因为里面已无空间。',

  'demo.finding.s3.title': '人工分蜂（分出群）',
  'demo.finding.s3.summary': '经典做法：把分蜂能量引导到新群组建上，而不是任其散失在空中。',
  'demo.finding.s3.urgencyNote': '今天傍晚前',
  'demo.finding.s3.probability': '效果已实践验证',
  'demo.finding.s3.risk': '若任由蜂群自行分蜂：带处女王的分蜂群可能飞到 5–10 公里外，老群将失去飞行蜂 3 周。可控分蜂能保住蜂群的两部分。',
  'demo.finding.s3.action': '用 3 张子脾组建分出群',
  'demo.evidence.s3.0': '声学 390 赫兹 — 王台已在成熟：蜂群已「定下分蜂方向」，仅靠扩巢未必能取消。',
  'demo.evidence.s3.1': '秤重：增重几乎停止（+0.05 公斤/天）— 蜂群既不造脾也不采蜜，全部能量用于准备分蜂。',
  'demo.evidence.s3.2': '群势很强（平常日清晨下降 −1.4 公斤）— 用 3 张子脾组建的分出群可以完全独立发展。',

  'demo.finding.s4.title': '保留最好的 2 个王台，其余割除',
  'demo.finding.s4.summary': '8 个王台太多了：控制王台数量可减少二次分蜂。',
  'demo.finding.s4.urgencyNote': '一周内',
  'demo.finding.s4.probability': '不干预时二次分蜂风险 — 55%',
  'demo.finding.s4.risk': '首次分蜂后 7–14 天，蜂群可能带着年轻蜂王再次分蜂（「静默」分蜂）— 直至完全衰弱为止。控制王台是标准预防措施。',
  'demo.finding.s4.action': '割除多余王台，保留 2 个',
  'demo.evidence.s4.0': '声学：现在就能听到蜂王鸣唱 — 群内多只蜂王同时成熟，这是「静默」二次分蜂的典型征兆。',
  'demo.evidence.s4.1': '温度传感器：王台区 41 °C — 蜜蜂将造脾区加温至 40–42 °C，而子脾区保持恒定的 35.0 °C。',
  'demo.evidence.s4.2': '访问量下降 — 老蜂王产卵已受限，蜂群转向繁殖。',

  // ── 晚间报告 ──
  'demo.evening.weight.title': '花蜜净增重',
  'demo.evening.weight.text':
    '采集蜂归巢后，全场一天净增 {gain} 公斤。最佳为第 {bestHive} 号箱 — {best} 公斤（以 {hz} 赫兹风干花蜜）。清晨采集蜂造成的下降均已被傍晚的增长补回。',
  'demo.evening.varroa.title': '螨害状态',
  'demo.evening.varroa.item': '第{n}号 — {p}%（{s}）',
  'demo.evening.varroa.itemF': '第{n}号 — {p}%（{s}，预测 {f}%）',
  'demo.evening.varroa.text': '{list}。临界阈值为 3%：3 号箱需要草酸防治 — 14 天后预测为 {f3}%。',
  'demo.evening.bloom.title': '按 GDD 预测开花',
  'demo.evening.bloom.text': '有效积温 {cur}/{need} — {name} 约在 {d} 天后开花（阈值已达 {pct}%）。请在开花前检查蜂箱容量。',
  'demo.evening.weather.title': '明天的飞行窗口',
  'demo.evening.weather.text': '预报：晴，最高 +24 °C，风速 3 米/秒，降水 10% — 飞行条件良好。检查最好在 11:00 前或 17:00 后进行，以免干扰采集蜂。',
  'demo.evening.done.title': '助手处方',
  'demo.evening.done.text': '过去一天完成的处方：{n} 项。各蜂箱指数已按已完成动作重新计算。',
  'demo.evening.doneNone.title': '助手处方',
  'demo.evening.doneNone.text': '过去一天没有完成的处方 — 请打开处方卡片并点击「完成」来标记动作。',

  // ── 图表、单位、杂项 ──
  'demo.chart.gainLabel': '日增重',
  'demo.chart.nightLabel': '夜间',
  'demo.chart.weightLabel': '重量',
  'demo.unit.kg': '公斤',
  'demo.unit.hz': '赫兹',
  'demo.unit.beesMin': '只/分',
  'demo.unit.km': '公里',
  'demo.hives.all4': '4 个蜂箱',
  'demo.agent.discussMsg': '我们来讨论一下第 {n} 号蜂箱的处方：{title}',
}

export const DEMO_DICTS: Record<Lang, Dict> = { ru: RU, en: EN, fr: FR, kk: KK, be: BE, zh: ZH }
