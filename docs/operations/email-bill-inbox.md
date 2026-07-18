# 邮件自动账单部署与运维

此功能只向已登录 Supabase 账号开放。用户开启后会获得一个随机专属地址，把微信、支付宝账单邮件自动转发到该地址即可。应用打开或回到前台时会自动刷新；用户在浏览器内输入每份 ZIP 的密码，密码不会上传或保存。

## 1. 准备接收域名

在 Resend 创建 Receiving Domain，推荐使用独立子域名，例如 `bills.example.com`，避免影响根域名现有邮箱。按照 Resend 控制台给出的值配置该子域名的 MX 记录，验证通过后保留完整域名备用。

Resend 会接收该域名下的所有地址；应用仅接受数据库里当前有效的 20 位随机别名，并且只处理恰好一个 ZIP 附件的邮件。

## 2. 部署数据库与 Edge Functions

关联 Supabase 项目并部署迁移：

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

生成至少 32 个随机字符的清理密钥，然后设置 Edge Function secrets：

```sh
npx supabase secrets set RESEND_API_KEY=re_xxx
npx supabase secrets set INBOUND_EMAIL_DOMAIN=bills.example.com
npx supabase secrets set BILL_CLEANUP_SECRET=replace-with-at-least-32-random-characters
```

`SUPABASE_URL`、`SUPABASE_ANON_KEY` 与 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Edge Functions 自动提供。service-role key 只能存在于 Edge Function，禁止写入任何 `VITE_*` 变量。

部署三个函数：

```sh
npx supabase functions deploy inbound-email --no-verify-jwt
npx supabase functions deploy manage-pending-bill --no-verify-jwt
npx supabase functions deploy cleanup-pending-bills --no-verify-jwt
```

## 3. 配置 Resend Webhook

在 Resend Dashboard → Webhooks 新增：

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/inbound-email
```

只勾选 `email.received`。创建后复制以 `whsec_` 开头的 Signing Secret，并写入 Supabase：

```sh
npx supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxx
```

Webhook 使用原始请求正文和三个 `svix-*` 请求头验证签名。验证失败的请求不会查询用户、下载附件或写入 Storage。

`manage-pending-bill` 虽以 `--no-verify-jwt` 部署以兼容浏览器 CORS 预检和新版 publishable key，但函数内部会使用请求中的 Bearer token 调用 `auth.getUser()`；未登录或无效 token 仍会返回 401，所有破坏性数据库操作只由 service role 执行。

## 4. 配置前端

开发机 `.env.local` 和生产托管环境都需要以下公开变量：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_INBOUND_EMAIL_DOMAIN=bills.example.com
```

重新构建前端。登录后进入“设置 → 邮件自动收账”，点击“开启邮件收取”，复制生成的专属地址并在常用邮箱中建立自动转发规则。

## 5. 配置七天自动清理

在 Supabase Dashboard → Integrations → Cron 建立每日 HTTP POST 任务：

```text
URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-pending-bills
Header: x-cleanup-secret: 与 BILL_CLEANUP_SECRET 相同的值
Schedule: 20 3 * * *
```

建议把 URL 和密钥放入 Supabase Vault，再通过 `pg_cron` + `pg_net` 调用，避免把密钥明文写进任务 SQL。每次最多清理 1000 条已过期的 `pending`/`failed` 记录；如积压超过 1000 条，后续每日任务会继续清理。

## 6. 数据生命周期与故障处理

- ZIP 最大 20 MiB，且必须仅包含一个微信或支付宝 CSV；解压后的账单最大 50 MiB。邮件中的 Excel 不会进入项目原有的 `xlsx` 解析器。
- PWA 对 Supabase 整个 origin 使用 `NetworkOnly`，私有 ZIP、Auth、REST 与 Edge Function 响应不会写入 Workbox API 缓存。
- 收到后附件进入私有 `bill-attachments` bucket，路径首段必须是用户 ID，用户只能读取自己的对象。
- SHA-256 仅在同一用户内去重；成功导入后保留哈希和最小处理元数据，原始 ZIP 立即删除。
- 未处理或失败附件七天后由清理任务永久删除。
- 用户主动删除或关闭邮件收取时，原始附件和相应队列记录立即永久删除，不提供撤销。
- 如果交易已导入但清理请求失败，预览会保留；再次确认时交易 external ID 去重，清理动作可重试。
- Resend Webhook 可重放。数据库对邮件 ID和用户内附件哈希都有唯一约束，重放不会生成重复卡片。

## 7. 上线检查

1. 用两个 Supabase 账号开启不同专属地址，确认彼此无法读取 inbox、队列和 Storage 对象。
2. 转发一份微信账单和一份支付宝账单，确认卡片只在对应账号出现。
3. 输入错误密码后立即重试正确密码，确认密码字段清空且服务端日志不包含密码。
4. 确认预览取消时 ZIP 保留；确认导入后 ZIP 删除、交易进入同步队列。
5. 重放同一 Resend Webhook，确认没有重复待处理账单。
6. 将一条测试记录的 `expires_at` 调整到过去并运行清理任务，确认记录和 Storage 对象都被删除。

参考：[Resend Receiving Emails](https://resend.com/docs/dashboard/receiving/introduction)、[Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets)、[Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)。
