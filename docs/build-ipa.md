# Build & cài IPA trên iPhone (không cần Mac, không cần tài khoản trả phí)

Tài liệu này mô tả quy trình đang dùng cho **chaybo**:

1. GitHub Actions build file `.ipa` **chưa ký** trên máy macOS miễn phí.
2. Bạn tải `.ipa` về Windows và cài bằng **Sideloadly** với Apple ID miễn phí.

> Vì sao phải làm vậy? Apple chỉ cho cài app lên iPhone khi app được ký bằng chứng
> chỉ Apple. EAS Build (Expo) cần **Apple Developer Program trả phí 99 USD/năm** cho
> ad-hoc distribution. Cách dưới đây dùng chứng chỉ *cá nhân miễn phí* do Sideloadly
> tạo, nên app **hết hạn sau 7 ngày** và phải cài lại.

---

## 1. Lấy file IPA

**Cách A — bản Release (dễ nhất)**

Mở: <https://github.com/kh4n9/chaybo/releases>

Chọn bản mới nhất → tải `chaybo-unsigned.ipa`.

**Cách B — tải từ Actions**

1. Vào <https://github.com/kh4n9/chaybo/actions>
2. Chọn workflow **Build unsigned iOS IPA** → run mới nhất
3. Kéo xuống mục **Artifacts** → tải `chaybo-unsigned-ipa.zip` → giải nén được `chaybo-unsigned.ipa`

**Cách C — tự build lại**

Vào tab **Actions** → chọn **Build unsigned iOS IPA** → **Run workflow** → **Run**.
Mất khoảng 15–25 phút.

---

## 2. Chuẩn bị trên Windows

| Thứ cần cài | Link |
| --- | --- |
| iTunes (bản Microsoft Store) hoặc **Apple Devices** | Microsoft Store |
| Sideloadly | <https://sideloadly.io> |
| Cáp USB (cáp sạc thường là đủ) | — |

Yêu cầu thêm trên iPhone:

- iOS 16 trở lên: bật **Cài đặt → Quyền riêng tư & Bảo mật → Chế độ nhà phát triển** (Developer Mode), máy sẽ khởi động lại.
- Apple ID **miễn phí** là đủ (không cần tham gia Developer Program).

---

## 3. Cài bằng Sideloadly

1. Cắm iPhone vào máy tính, bấm **Tin cậy (Trust)** trên iPhone.
2. Mở **Sideloadly**.
3. Kéo file `chaybo-unsigned.ipa` vào ô **IPA**.
4. Ô **Apple ID**: nhập Apple ID của bạn (Sideloadly chỉ dùng để tạo chứng chỉ, mật khẩu đi thẳng tới Apple).
5. Bấm **Start**.
6. Khi được hỏi, nhập mật khẩu Apple ID (và mã 2FA nếu có).
7. Chờ tới khi hiện **✅ Done**.

### Tin cậy app sau khi cài

iPhone → **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị → Apple Development: <email của bạn> → Tin cậy**.

Sau đó mở **chaybo** từ màn hình chính.

---

## 4. Giới hạn của Apple ID miễn phí

| Giới hạn | Giá trị |
| --- | --- |
| Thời hạn chứng chỉ | **7 ngày** (sau đó app không mở được) |
| Số app cùng lúc | 3 |
| App ID mới mỗi tuần | 10 |
| Phải cài lại | Có — chạy lại Sideloadly với cùng file IPA |

**Gia hạn:** mở Sideloadly, cài lại **đúng file IPA đó** (cùng bundle id `com.chaybo.app`).
Dữ liệu chạy bộ **không mất** vì SQLite nằm trong app và bị ghi đè cùng bundle id.

> ⚠️ Nếu bạn **xoá app** khỏi iPhone thì toàn bộ dữ liệu SQLite mất theo.
> Trước khi xoá, vào **Cài đặt → Dữ liệu → Xuất bản sao lưu** để lưu file JSON ra ngoài.

---

## 5. Sau khi cài, bật các quyền cần thiết

Vào app → **Cài đặt** (hoặc lần chạy đầu):

1. **Vị trí:** chọn **Luôn cho phép** (Always) để GPS nền hoạt động khi tắt màn hình.
2. **Chuyển động & thể dục:** cho phép để đếm nhịp bước (cadence).
3. **Thư viện ảnh:** cho phép để đính kèm ảnh buổi chạy.
4. **Face ID:** nếu bật khoá app trong Cài đặt.

Kiểm tra nhanh: vào màn ghi, dòng trạng thái phải hiện `GPS nền · ±x m`.

---

## 6. Khi nào nên mua Apple Developer (99 USD/năm)?

Mua khi bạn:

- Muốn app **không hết hạn sau 7 ngày**.
- Muốn cài cho người khác qua link (ad-hoc, tối đa 100 thiết bị).
- Muốn đưa lên **TestFlight / App Store**.

Khi đã có tài khoản, đổi sang EAS:

```bash
npx eas-cli build --platform ios --profile preview
```

EAS sẽ hỏi Apple ID và tự tạo certificate + provisioning profile, trả về link cài trực tiếp.

---

## 7. Ghi chú kỹ thuật

- Workflow: `.github/workflows/ios-unsigned.yml`
- Chạy trên `macos-15`, Xcode 16.4, Node 22.
- `npx expo prebuild --platform ios --clean` sinh project native (CNG — không commit thư mục `ios/`).
- Build bằng `xcodebuild ... CODE_SIGNING_ALLOWED=NO` → `.xcarchive` → đóng gói `Payload/*.app` thành `.ipa`.
- App dùng các module native: `expo-location` (background), `expo-sensors` (pedometer), `expo-image-picker`, `expo-local-authentication`, `expo-sqlite`, `react-native-maps`, `react-native-view-shot`, `expo-dev-client`.
- `expo-dev-client` **không** bật dev launcher ở cấu hình Release, nên app chạy như bản thường.
