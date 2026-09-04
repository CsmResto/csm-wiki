---
title: Creation And Editing
description:
summary:
order: 2
updatedAt: 2026-08-18
---
[[delimiter rows=1]]


## Creating an RFM Status

To create a new RFM Status, click **Edit**, then **Add RFM Status**, fill in the fields, and click **Add**.

![Create RFM Status](/en/images/rfm/rfm-create-en.png)

[[delimiter rows=1]]


- **Status Name**

- **Color**

- **Description**

- **Recency (R)** — determines how long ago the guest's last order should have been to match the status. If **All Time** is enabled, the day limit is removed and the guest's entire order history is included in the calculation.

- **Frequency (F)** — determines the minimum number of orders the guest must make during the selected period.

- **Monetary (M)** — determines the minimum amount the guest must spend during the selected period.

[[info type=custom color=#E06823]]
After an RFM Status is created, the system automatically recalculates RFM and distributes guests according to the current rules.
[[/info]]



## Editing an RFM Status

After clicking **Edit**, the page switches to edit mode.

![Edit RFM Status](/en/images/rfm/rfm-edit-en.png)

[[delimiter rows=1]]

On the editing page, you can make the following changes:

- **Calculation Horizon.** Specify the period in days used to calculate **Frequency** and **Monetary**. After the new settings are applied, the number of guests in the RFM Statuses will be recalculated.

- **Changing Priority.** Change the priority of RFM Statuses by dragging and dropping the rows. If a guest meets the conditions of several statuses at the same time, the status with the higher priority will be assigned.

- **Adding an RFM Status.**

- **Editing an RFM Status.** Click the row of the required RFM Status to change its parameters.

[[info type=custom color=#E06823]]
After the changes are saved, the system automatically recalculates RFM and distributes guests according to the current rules.
[[/info]]



## Deleting an RFM Status

1. Click **Edit**.
2. Right-click the required RFM Status.
3. Select **Delete RFM Status**.
4. Confirm the deletion.

[[info type=custom color=#E06823]]
After an RFM Status is deleted, the system automatically recalculates RFM and distributes guests according to the current rules.
[[/info]]



[[delimiter rows=3]]

---