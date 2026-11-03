# chaybo

Ứng dụng ghi lại buổi chạy bộ cho iOS, làm bằng Expo / React Native + TypeScript. Toàn bộ dữ liệu lưu **offline trên máy** (SQLite), không cần tài khoản, không có backend.

Đây là bản MVP tập trung vào vòng lặp cốt lõi: **ghi GPS → xem lại lịch sử → xem chi tiết → tạo ảnh chia sẻ**, kèm cài đặt mục tiêu tuần và xuất/nhập dữ liệu. Trên nền đó là một lớp tính năng kiểu Strava: **best effort, huy hiệu, lịch tập, chuỗi ngày, tìm kiếm/lọc, ghi chú – cảm nhận và nhập GPX**.

---

## Tính năng hiện có

| Màn hình | Nội dung |
| --- | --- |
| **Ghi buổi chạy** (`/record`) | Bản đồ tối theo vị trí, vẽ lộ trình realtime, quãng đường / thời gian / pace hiện tại, tạm dừng – tiếp tục – kết thúc. Giữ màn hình luôn sáng và rung phản hồi khi bắt đầu/dừng. |
| **Lịch sử** (tab 1) | Tổng km tuần này, thanh tiến độ mục tiêu tuần, danh sách buổi chạy với hình thu nhỏ lộ trình (SVG, không dùng MapView để danh sách mượt). **Tìm kiếm theo tên/ghi chú** (bỏ dấu tiếng Việt), **lọc Tuần / Tháng / Năm / Tất cả** và **bộ lọc nâng cao** theo cự ly tối thiểu, cảm giác, loại buổi. Kéo xuống để làm mới; bánh răng mở Cài đặt. |
| **Chi tiết** (`/activity/[id]`) | Bản đồ lộ trình, quãng đường, thời gian, pace trung bình, độ cao, calo, biểu đồ pace từng km, bảng splits, **best effort riêng của buổi chạy**. **Chọn cảm nhận (1–5) và viết ghi chú**. Đổi tên, xuất GPX riêng, xoá buổi chạy. |
| **Ảnh chia sẻ** | Thẻ 4:5 dựng bằng view thật rồi chụp ảnh (`react-native-view-shot`) và mở share sheet của iOS. **Ba mẫu: Cổ điển, Tối giản, Poster** (nền vàng chanh). |
| **Thống kê** (tab 2) | Tổng toàn thời gian, **chuỗi ngày hiện tại / dài nhất** kèm ngày bảo lưu, **mục tiêu tháng & năm**, **VO2max ước tính**, so sánh tuần này / tuần trước, **lịch tập 16 tuần** kiểu GitHub, **bản đồ nhiệt khu vực hay chạy**, biểu đồ 8 tuần gần nhất, kỷ lục cá nhân, **500 huy hiệu** kèm tiến độ, lối tắt tới các công cụ. |
| **Kế hoạch tập** (`/plan`) | Giáo án 8–16 tuần theo mục tiêu (5K/10K/21K/42K) và trình độ; danh sách buổi theo tuần, tiến độ hoàn thành, buổi tiếp theo. |
| **Biến tốc** (`/interval`) | Đồng hồ đếm ngược cho bài interval có sẵn hoặc tự chọn, rung khi đổi hiệp, giữ màn hình sáng. |
| **Đoạn chạy quen** (`/segments`) | Nhóm các buổi chạy trùng điểm đầu/cuối và xếp hạng thời gian trên từng đoạn. |
| **Hồi phục** (`/recovery`) | Ghi vị trí đau, mức độ và ghi chú; gợi ý giữ tải / giảm tải / nghỉ dựa trên 14 ngày gần nhất. |
| **Kỷ lục** (`/records`) | **Best effort 400 m, 1 km, 1 dặm, 5 km, 10 km**: thời gian nhanh nhất cho từng cự ly, pace và buổi chạy đã tạo nên kỷ lục. |
| **Cài đặt** (`/settings`) | Cân nặng, mục tiêu km/tuần, **tháng, năm**, **ngày bảo lưu chuỗi**, **mục tiêu & trình độ kế hoạch**, xuất `.gpx`/`.tcx`, sao lưu `.json`, nhập `.gpx`, khôi phục `.json`, giày & thiết bị, xoá dữ liệu. |

Nút bắt đầu chạy là nút tròn màu vàng chanh ở giữa thanh tab. Màn hình ghi chạy dưới dạng **modal toàn màn hình** nên không thể vô tình đổi tab làm mất buổi chạy; muốn thoát phải bấm X và xác nhận huỷ.

### Nâng cấp mới (đợt 4)

- **Kế hoạch tập** (`/plan`): giáo án 8 tuần (5K), 10 tuần (10K), 12 tuần (bán marathon) hoặc 16 tuần (marathon) theo 3 trình độ; tự sinh lịch từng tuần, đánh dấu buổi đã hoàn thành và gợi ý buổi tiếp theo.
- **Đồng hồ biến tốc** (`/interval`): bài mẫu 6×400 m, 5×800 m, 4×1 km, kim tự tháp, fartlek và chế độ tự chọn; đếm ngược từng hiệp, rung khi chuyển hiệp, giữ màn hình sáng.
- **Đoạn chạy quen** (`/segments`): tự nhóm các buổi chạy có cùng điểm đầu/cuối (bán kính 200 m) và so sánh thời gian, pace, khoảng cách với kỷ lục trên đoạn đó.
- **Bản đồ nhiệt khu vực** trong Thống kê: chiếu toàn bộ lộ trình đã lưu lên một khung duy nhất và tô mật độ — hoàn toàn cục bộ, không tải tile bản đồ.
- **Mục tiêu tháng & năm** cạnh mục tiêu tuần, kèm thanh tiến độ và số ngày còn lại.
- **Bảo lưu chuỗi ngày**: cho phép cấu hình 0–5 ngày nghỉ mà chuỗi không bị đứt.
- **Nhật ký hồi phục** (`/recovery`): ghi vị trí đau, mức độ 1–5 và ghi chú; app tổng hợp 14 ngày gần nhất để khuyên giữ tải, giảm tải hay nghỉ.
- **Bộ lọc lịch sử nâng cao**: cự ly tối thiểu, cảm giác (1–5) và loại buổi chạy, kết hợp được với tìm kiếm và khoảng thời gian.
- **VO2max ước tính** theo mô hình Daniels/Gilbert từ buổi chạy nhanh nhất, kèm xếp loại.

### Nâng cấp mới (đợt 3)

- **Đơn vị km/mi và giao diện sáng/tối** trong Cài đặt.
- **Lap thủ công** trong lúc ghi (nút Lap) và tự động tạm dừng khi đứng yên.
- **Thời tiết** lưu cùng buổi chạy (Open-Meteo) và nhắc uống nước.
- **Giày & thiết bị** theo dõi quãng đường từng đôi.
- **Tải tập luyện** (tỉ lệ tải 7/28 ngày) trong Thống kê.
- **Dự đoán thành tích** (Riegel) từ kỷ lục cá nhân.
- **Giãn cơ sau chạy** (`/stretch`).
- **Yêu thích** buổi chạy (sao) và lọc.
- **Mẫu ảnh chia sẻ Neon**.
- **Xuất TCX** (Garmin Training Center).
- **Độ đều pace**, **nhịp chạy theo thứ/khung giờ**, **lịch tháng**.

### Nâng cấp mới (đợt 2)

- **Loại buổi chạy** (easy, tempo, long, race, recovery, interval) gán và chỉnh sửa trong chi tiết; hiển thị trong danh sách.
- **Sắp xếp & nhóm theo tháng** trong Lịch sử: mới nhất, cũ nhất, xa nhất, nhanh nhất; gom nhóm theo tháng khi sắp xếp theo thời gian.
- **Tìm kiếm theo ghi chú** ngoài tên buổi chạy.
- **Hồ sơ độ cao** trong chi tiết (biểu đồ độ cao theo lộ trình) cùng tổng leo.
- **So với buổi trước**: so sánh quãng đường, pace và độ cao với buổi chạy gần nhất trước đó.
- **Lịch tháng** (`/calendar`): lưới tháng với đánh dấu ngày đã chạy, chọn ngày để xem các buổi chạy.
- **Nhịp chạy theo thứ & khung giờ** trong Thống kê: biểu đồ theo thứ và 4 khung giờ (sáng/trưa/chiều/tối), kèm gợi ý.
- **Độ đều pace** (0–100) trong chi tiết, dựa trên độ lệch giữa các km.
- **Phát hiện trùng GPX** khi nhập: buổi chạy trùng với dữ liệu hiện có bị bỏ qua.
- **Nhắc sao lưu**: banner trong Lịch sử và ngày sao lưu cuối trong Cài đặt; tự ghi nhận khi xuất `.json`.
- **Đếm ngược 3 giây** trước khi bắt đầu ghi và **tự động tạm dừng** khi đứng yên > 20 giây, tự tiếp tục khi chạy lại.

## Công nghệ

- **Expo SDK 58** / React Native 0.88 / React 19 / TypeScript
- **Expo Router** (routes trong `src/app/`)
- **expo-location** — `watchPositionAsync` (foreground) + `startLocationUpdatesAsync` (nền, chỉ dev build)
- **expo-sqlite** — lưu hoạt động, lộ trình, splits, cài đặt
- **expo-file-system + expo-sharing** — tạo tệp `.gpx`/`.json` và mở share sheet
- **expo-document-picker** — chọn tệp `.json` để khôi phục và tệp `.gpx` để nhập
- **react-native-maps** — Apple Maps trên iOS, không cần API key
- **react-native-svg** — vẽ lộ trình dạng vector
- **react-native-view-shot** — chụp thẻ chia sẻ thành ảnh
- **expo-haptics**, **expo-keep-awake**, **expo-linear-gradient**

## Yêu cầu

- Node.js LTS (20 trở lên) và npm
- Một iPhone có **Expo Go** (tải trên App Store)
- Điện thoại và máy tính **cùng một mạng Wi-Fi**

## Chạy thử trên iPhone (từ Windows)

```bash
cd chaybo-app
npm install
npx expo start
```

1. Mở **Expo Go** trên iPhone.
2. Quét mã QR hiện trong terminal (iOS dùng app Camera, không cần quét trong Expo Go).
3. Lần đầu mở app sẽ hỏi quyền vị trí — chọn **Cho phép khi dùng ứng dụng**.

Nếu điện thoại không kết nối được (Wi-Fi có chặn thiết bị, mạng công ty, 4G khác mạng), dùng tunnel:

```bash
npx expo start --tunnel
```

Chạy lại sau khi sửa code: chỉ cần lưu file, app tự reload.

### Chưa có buổi chạy nào?

Ở màn hình Lịch sử, bấm **“Xem thử với dữ liệu mẫu”** để sinh 6 buổi chạy quanh Hồ Hoàn Kiếm và Công viên Thống Nhất (Hà Nội). Dữ liệu mẫu được tạo cố định nên hình dạng lộ trình luôn giống nhau.

## Cấu trúc thư mục

```
chaybo-app/
├─ src/
│  ├─ app/                  # routes (mỗi file là một màn hình)
│  │  ├─ _layout.tsx        # Stack gốc + SQLiteProvider + SettingsProvider
│  │  ├─ (tabs)/            # thanh tab: Lịch sử, Thống kê
│  │  ├─ record.tsx         # modal ghi buổi chạy
│  │  ├─ records.tsx        # best effort 400 m → 10 km
│  │  ├─ calendar.tsx       # lịch tháng
│  │  ├─ plan.tsx           # kế hoạch tập theo mục tiêu
│  │  ├─ interval.tsx       # đồng hồ biến tốc
│  │  ├─ segments.tsx       # đoạn chạy quen
│  │  ├─ recovery.tsx       # nhật ký đau & hồi phục
│  │  ├─ stretch.tsx        # giãn cơ sau chạy
│  │  ├─ settings.tsx       # modal cài đặt, xuất/nhập dữ liệu
│  │  └─ activity/[id].tsx  # chi tiết, ghi chú, GPX, ảnh chia sẻ
│  ├─ components/           # TabBar, RouteShape, BarChart, ShareCard,
│  │                        # TrainingHeatmap, AreaHeatmap, BadgeGrid, ...
│  ├─ db/                   # schema, query, cài đặt, hồi phục, dữ liệu mẫu
│  ├─ hooks/                # useRecording, useActivities, useSettings
│  └─ lib/                  # theme, format, geo, splits, stats, export, backup,
│                           # efforts, calendar, badges, gpx, feeling, runType,
│                           # rhythm, consistency, trainingPlan, interval,
│                           # segments, heatmap, goals, vo2max, recovery
├─ app.json                 # cấu hình Expo (quyền vị trí, splash, bundle id)
├─ scripts/generate-assets.py  # vẽ lại icon/splash bằng Pillow
└─ package.json
```

## Nhận diện

Icon và splash được vẽ bằng code (`scripts/generate-assets.py`), không phải ảnh mua sẵn: một vòng chạy màu vàng chanh `#D8FF3E` trên nền `#08090A`, có một điểm tròn đánh dấu điểm bắt đầu — đồng bộ với dấu chấm trong wordmark `chaybo.` trong app.

Sửa màu trong `src/lib/theme.ts` thì nên sửa cả script rồi chạy lại:

```bash
python scripts/generate-assets.py   # cần Pillow: pip install pillow
```

## Dữ liệu được lưu ở đâu?

SQLite, file `chaybo.db` trong sandbox của app. **Xoá app là mất toàn bộ dữ liệu**, nên hãy sao lưu định kỳ:

- **Sao lưu `.json`** (Cài đặt → Dữ liệu) chứa toàn bộ buổi chạy, lộ trình, splits và cài đặt.
- **Khôi phục từ `.json`** nhập lại tệp đó. Buổi chạy trùng mã sẽ bị ghi đè nên nhập nhiều lần không tạo bản trùng.
- **Xuất `.gpx`** để đưa lịch sử sang Strava, Garmin Connect hoặc Google Earth.
- **Nhập `.gpx`** (Cài đặt → Dữ liệu) để mang buổi chạy từ Strava, Garmin, Apple Watch vào chaybo. Mỗi `<trkseg>` thành một buổi riêng; tệp không có toạ độ hoặc thời gian sẽ bị từ chối. Nhập lại cùng một tệp sẽ tạo bản sao, vì GPX không có mã định danh.
- Tệp xuất ra đi qua share sheet của iOS: lưu vào Files, gửi qua AirDrop/Zalo, hoặc mở bằng app khác.

## Giới hạn đã biết của bản MVP

- **Ghi nền (background GPS)** chỉ chạy trong **development build** (không phải Expo Go). Trong Expo Go, app phải ở foreground. Khi build dev, app tự xin quyền “Luôn cho phép” và ghi ngay cả khi tắt màn hình (có thông báo foreground service trên Android).
- **Không đo nhịp tim** vì chưa có cảm biến; biểu đồ pace thay cho biểu đồ HR. HealthKit (nhịp tim, VO2max) cần native module + dev build — chưa tích hợp.
- **Calo là ước lượng** theo công thức ~1 kcal/kg/km với cân nặng bạn nhập trong Cài đặt (mặc định 62 kg). Buổi chạy cũ giữ nguyên calo đã lưu.
- **Best effort cần GPS đủ dày.** Cự ly càng ngắn (400 m) càng dễ lệch nếu tín hiệu thưa; kỷ lục được tính lại mỗi lần mở màn hình Kỷ lục.
- **Huy hiệu và chuỗi ngày là offline**, không có giải thưởng hay so sánh với người khác.
- **Không có feed, kết bạn hay leaderboard** — những tính năng này cần backend nên nằm ngoài phạm vi bản local.
- **Đoạn chạy quen là phiên bản cá nhân**, nhóm theo điểm đầu/cuối chứ không phải segment do cộng đồng tạo; thời gian trên đoạn là ước tính từ pace trung bình của cả buổi.
- **VO2max là ước tính** từ một buổi chạy, không phải phép đo trong phòng thí nghiệm.
- **Live Activity và widget** (iOS) cần `expo-widgets` + dev build; chưa tích hợp trong bản hiện tại. Ghi nền đã sẵn sàng cho dev build.
- **Giao diện sáng và đơn vị dặm (km/mi)** đã áp dụng toàn app (Cài đặt → Giao diện & đơn vị). Mục tiêu tuần/tháng/năm lưu theo km và tự quy đổi ở UI.
- Tiếng Việt là ngôn ngữ duy nhất.

## Build bản cài thật trên iOS

Expo Go chỉ để chạy thử. Có 2 cách cài app lên iPhone thật:

**Cách 1 — miễn phí (đang dùng): GitHub Actions + Sideloadly**

Repo có workflow build sẵn file `.ipa` **chưa ký** trên macOS của GitHub, bạn tải về và ký bằng
Apple ID miễn phí với Sideloadly trên Windows:

1. Tải `.ipa` mới nhất ở <https://github.com/kh4n9/chaybo/releases>
2. Cài bằng Sideloadly (xem hướng dẫn chi tiết: [`docs/build-ipa.md`](docs/build-ipa.md))

Hạn chế: chứng chỉ hết hạn sau **7 ngày**, tối đa 3 app cùng lúc, phải cài lại bằng cùng file IPA.
Bù lại không cần Mac và không cần tài khoản trả phí.

**Cách 2 — có Apple Developer Program (99 USD/năm): EAS Build**

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure   # tạo eas.json nếu chưa có
npx eas-cli@latest build --platform ios --profile preview
```

- Cần **Apple Developer Program** cho thiết bị thật (ad-hoc) và TestFlight/App Store.
- Cấu hình bundle id hiện tại: `com.chaybo.app` (sửa trong `app.json` nếu muốn tên khác).
- Sau khi build xong, EAS gửi link cài đặt; mở bằng iPhone và làm theo hướng dẫn.

### Development build (để dùng GPS nền)

Bản `preview`/`production` không có dev tools và vẫn có thể ghi nền nếu app đã được cấp quyền “Always”. Nhưng để phát triển và thử GPS nền, dùng **development build**:

```bash
cd chaybo-app
npx expo install expo-dev-client expo-task-manager   # đã có trong repo
npx eas-cli@latest build --platform ios --profile development            # thiết bị thật
npx eas-cli@latest build --platform ios --profile development-simulator  # iOS Simulator
```

Trong dev build, màn hình Ghi sẽ tự xin quyền “Luôn cho phép”; nếu được cấp, app tiếp tục ghi khi tắt màn hình (iOS hiện thanh xanh “chaybo đang dùng vị trí của bạn”; Android hiện thông báo foreground service). Nếu bị từ chối, app vẫn ghi được khi ở foreground.

**Lưu ý Windows:** không build iOS cục bộ được (cần Xcode/macOS). Dùng GitHub Actions
(`.github/workflows/ios-unsigned.yml`) hoặc EAS cloud. Android có thể build cục bộ bằng `npx expo run:android` nếu cài Android Studio.

### HealthKit, Live Activity, widget (chưa tích hợp)

- **HealthKit** (nhịp tim, VO2max từ Apple Health): không có module chính thức trong Expo SDK 58. Cần thư viện bên thứ ba (ví dụ `@kingstinct/react-native-healthkit`) + dev build + entitlement `com.apple.developer.healthkit` trong app config. Chưa tích hợp; để làm sau.
- **Live Activity** (Dynamic Island / Lock Screen): dùng `expo-widgets` (`createLiveActivity`), chỉ iOS, dev build, **không** thêm entry vào `widgets[]`.
- **Widget màn hình chính**: dùng `expo-widgets` (`createWidget`), iOS + Android, dev build, cần entry trong `widgets[]` của app config và file widget đánh dấu `'widget'`.

Cài khi cần:

```bash
npx expo install expo-widgets
# sau đó thêm plugin + widgets[] vào app.json, rồi build lại dev build
```

## Lệnh hữu ích

```bash
npx expo start          # chạy dev server
npx expo start --tunnel # khi Wi-Fi chặn kết nối LAN
npm run typecheck       # kiểm tra TypeScript
npx eslint .            # lint (dùng trực tiếp, `expo lint` đang lỗi version)
npx expo-doctor         # kiểm tra cấu hình & dependency
npx expo install <pkg>  # cài thư viện đúng version cho SDK 58
```

> **Lưu ý:** repo có `.npmrc` với `legacy-peer-deps=true` vì `expo-router@58` kéo `react-dom@19.3.1` yêu cầu `react ^19.3.1` trong khi SDK 58 ghim `react@19.3.0`. Đừng xoá file này nếu chưa có bản SDK sửa được xung đột.

## Hướng phát triển tiếp

1. **Ghi nền** — ✅ đã có code (`expo-task-manager` + background location) và cấu hình dev build; cần build dev để thử trên máy thật.
2. **Đồng bộ & xã hội** — backend + feed + follow, segment, leaderboard (đúng hướng Strava).
3. **Tuỳ chỉnh thêm** — giọng đọc pace mỗi km, nhắc nghỉ, thông báo buổi tập theo kế hoạch.
4. **Ảnh đính kèm** — ghi chú và cảm nhận đã có; bước tiếp theo là thêm ảnh chụp vào buổi chạy.
5. **Dev build** — chuyển các phần cần native sang development build: HealthKit, Live Activity, widget và thông báo cục bộ cho kế hoạch tập. GPS nền đã sẵn sàng.

---

Tham khảo phân tích Strava và định hướng sản phẩm: [`../phan-tich-strava.md`](../phan-tich-strava.md)
