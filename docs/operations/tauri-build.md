# Tauri 桌面与 Android 构建

项目使用 Tauri 2，应用标识为 `best.kakeibo.client`。原生构建会自动关闭 PWA Service Worker，避免 App 使用旧缓存。

## 本机环境

当前 macOS 开发机使用：

- Rust stable 与四个 Android target
- OpenJDK 17：`/opt/homebrew/opt/openjdk@17`
- Android SDK：`/opt/homebrew/share/android-commandlinetools`
- Android NDK 28.2：`/opt/homebrew/share/android-commandlinetools/ndk/28.2.13676358`

新终端执行 Android 命令前设置：

```sh
export PATH="/opt/homebrew/opt/rustup/bin:/opt/homebrew/opt/openjdk@17/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"
```

## 开发与构建

```sh
# macOS 开发
npm run tauri:dev

# macOS .app 与 .dmg
npm run tauri:build:mac

# 连接 Android 真机或启动模拟器后开发
npm run tauri:android:dev

# Android release APK 与 AAB
npm run tauri:android:build
```

## 签名

macOS 当前使用 ad-hoc 签名，适合本机测试；公开分发需要 Apple Developer 的 Developer ID Application 证书并完成 notarization。

Android 调试 APK 可直接安装。Release APK/AAB 默认未签名；上架前按 Tauri Android signing 文档创建并保管个人 upload keystore，在 `src-tauri/gen/android/keystore.properties` 与 `app/build.gradle.kts` 配置。Keystore、密码和 properties 文件不得提交 Git。

## Supabase 邮箱验证码

原生应用使用应用内 6 位邮箱验证码，不使用浏览器 Magic Link。托管 Supabase 项目需要在 Dashboard 中打开：

`Authentication → Email Templates → Magic Link`

将邮件正文中的 `{{ .ConfirmationURL }}` 链接替换为验证码变量，例如：

```html
<h2>家計簿登录验证码</h2>
<p>请在应用中输入以下 6 位验证码：</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>验证码将在设置的 OTP 有效期后失效。如果不是你本人操作，请忽略此邮件。</p>
```

保存模板后重新发送验证码。前端不会再传递 `emailRedirectTo`，收到验证码后会通过 `verifyOtp({ email, token, type: 'email' })` 在当前 App 内完成登录。
