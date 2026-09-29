# 数据库说明

SQLite 文件位置：`Data/invoices.db`

## invoices

本地发票池主表，一张发票对应一条有效记录和一份原始附件。

| 字段 | 中文说明 |
|---|---|
| id | 本地自增主键 |
| invoice_date | 开票日期 |
| amount | 开票金额 |
| buyer | 购买方名称 |
| seller | 销售方名称 |
| invoice_number | 发票号码；有值时全表唯一 |
| file_path | 项目内保存的原始附件路径 |
| file_hash | 原始附件 SHA-256；全表唯一 |
| source | 来源；`manual` 手动上传，`email` 邮箱同步 |
| status | 使用状态；`unused` 未使用，`used` 已使用 |
| used_month | 使用月份；已使用时必填，未使用时自动清空 |
| note | 备注 |
| recognition_status | 识别状态；`success` 完整，`incomplete` 不完整 |
| created_at | 创建时间 |
| updated_at | 更新时间 |

## email_accounts

IMAP 邮箱账号配置表，不保存授权码或应用密码明文。

| 字段 | 中文说明 |
|---|---|
| id | 本地自增主键 |
| email | 邮箱地址 |
| imap_host | IMAP 主机 |
| imap_port | IMAP 端口 |
| ssl_enabled | 是否启用 SSL |
| enabled | 是否启用同步 |
| credential_reference | Windows Credential Manager 凭据引用 |
| created_at | 创建时间 |
| updated_at | 更新时间 |

## scanned_emails

已成功扫描邮件记录表，用于避免重复扫描。

| 字段 | 中文说明 |
|---|---|
| id | 本地自增主键 |
| email_account_id | 邮箱账号 ID |
| message_uid | IMAP 稳定 UID |
| message_id | 邮件 Message-ID |
| scanned_at | 扫描成功时间 |
| result | 扫描结果摘要；无支持附件也会记录为成功扫描 |
