---
title: Подключение REDSMS & Twilio
description: Подключение и настройка REDSMS & Twilio для информирования гостей через COSMOS. 
summary: Подключение SMS сервисов
order: 2
updatedAt: 2026-06-01
---

**REDSMS** и **Twilio** — сервисы для автоматической отправки SMS и других уведомлений через API.

Выбор сервиса зависит от региона:
- **[REDSMS](https://redsms.ru/)** - для России.
- **[Twilio](https://www.twilio.com/)** - для всех остальных стран.

## Подключение REDSMS:

**1.** Если у вас ещё нет аккаунта, зарегистрируйтесь в сервисе **REDSMS** и выполните необходимые процедуры для активации отправки SMS. Пополните баланс аккаунта.

**2.** Войдите в настройки пользователя или создайте нового пользователя.

**3.** Перейдите в раздел `Аккаунт -> Доступ к разделам` и включите опцию `Отправка сообщений через API`.

![redsms](/ru/images/connection/redsms-twilio-connect/redsms-twilio-connect-1.jpg)

[[delimiter rows=1]]

**4.** Перейдите в раздел `Ограничения -> Ограничения по странам` и установите значение **только Россия**.

![redsms](/ru/images/connection/redsms-twilio-connect/redsms-twilio-connect-2.jpg)

[[delimiter rows=1]]

**5.** Откройте раздел `HTTP API` и установите следующие настройки:

1. Включите параметр `Callback`
2. Укажите URL, предоставленный поддержкой COSMOS
3. В списке передаваемых полей выберите: `uuid`, `status`, `status_time`, `clientField`

![redsms](/ru/images/connection/redsms-twilio-connect/redsms-twilio-connect-3.jpg)

[[delimiter rows=1]]

**6.** Сохраните настройки.

**7.** В разделе `HTTP API` сгенерируйте **API-ключ** и перейдайте его в поддержку COSMOS.

**8.** Дождитесь завершения настройки интеграции со стороны COSMOS.

[[info type=custom color=#E06823]]
Чтобы при отправке SMS отображалось желаемое вами имя отправителя, необходимо зарегистрировать альфа-имя у каждого оператора связи отдельно. Настройка выполняется в REDSMS отдельно.
[[/info]]

## Подключение Twilio:

**1.** Если у вас ещё нет аккаунта, зарегистрируйтесь в сервисе **Twilio** и выполните необходимые процедуры для активации отправки SMS. Пополните баланс аккаунта.

**2.** Для настройки интеграции необходимо передать в поддержку COSMOS следующие данные:
   - Account SID
   - API Key SID
   - API Key Secret
   - Messaging Service SID

### Account SID

1. Перейдите в раздел `Dashboard -> Account Info` (главная страница консоли Twilio)
2. Скопируйте поле **Account SID**.

### Api Key SID и Api Key Secret

1. Перейдите в раздел `Console -> Account -> API keys & tokens`
2. Создайте новый ключ `Create API Key`
3. Выберите тип (Standard или Main)
4. После создания показывается:
    - SID (уже не показывается повторно)
    - Secret (показывается один раз, нужно сохранить сразу)

### Messaging Service SID
1. Перейдите в раздел `Console -> Messaging -> Services`
2. Выберите существующий сервис или создайте новый `Create Messaging Service`
3. Перейдите внутри сервиса в раздел `Overview`
4. Скопируйте поле `Messaging Service SID`

[[info type=custom color=#E06823]]
Передайте все собранные реквизиты в поддержку COSMOS и дождитесь завершения настройки интеграции. Мы проинформируем вас о дальшейших шагах.
[[/info]]

[[delimiter rows=3]]