# High-Quality Image Export Functionality Analysis

## Overview

This document explains how the original PySide2-based application exports edited images as high-quality PNG files without quality degradation. The export functionality creates a high-resolution output image by separately processing each component (images, frame overlays, and text) at the target DPI before compositing them together.

## Core Implementation

### 1. High-Resolution Target Setup

The export process begins by setting up a high-resolution canvas at 1200 DPI:

```python
# 고해상도 설정
target_dpi = 1200
current_dpi = QtGui.QGuiApplication.primaryScreen().logicalDotsPerInch()
dpi_ratio = target_dpi / current_dpi
width_px = int((15 * target_dpi) / 2.54)   # 15cm at 1200 DPI
height_px = int((10 * target_dpi) / 2.54)  # 10cm at 1200 DPI

if self.width_px == self.px_10:  # 세로 방향
    width_px = int((10 * target_dpi) / 2.54)   # 10cm at 1200 DPI
    height_px = int((15 * target_dpi) / 2.54)  # 15cm at 1200 DPI

# 결과 이미지 생성
result_image = self.create_canvas(width_px, height_px)
```

This creates a canvas that's much larger than the display resolution (719x483 or 483x719 pixels), ensuring that the final output has enough pixels for high-quality printing.

### 2. Scaling Ratio Calculation

To map the UI coordinates to the high-resolution output, scaling ratios are calculated:

```python
# 화면 크기와 출력 크기의 비율 계산
scale_x = width_px / self.width_px
scale_y = height_px / self.height_px
```

These ratios are used to scale all positions and dimensions from UI space to output space.

### 3. Image Processing at Target Resolution

Each edited image is processed at the target resolution to avoid quality loss:

```python
for idx, label in enumerate(self.image_labels[current_mode]):
    if self.images[current_mode][idx] is None:
        continue  # 이미지가 없으면 건너뛰기

    cv_img = self.images[current_mode][idx]
    
    # 스케일 적용 (at target resolution)
    scale_ratio = float(self.scale[current_mode][idx]) * 0.01
    width = int(cv_img.shape[1] * scale_ratio * scale_x)
    height = int(cv_img.shape[0] * scale_ratio * scale_y)
    scaled_img = cv2.resize(cv_img, (width, height), interpolation=cv2.INTER_LANCZOS4)
```

Key points:
- The original high-quality image (`cv_img`) is resized directly to the target resolution
- The scale factor from the UI (`scale_ratio`) is applied at full resolution
- LANCZOS4 interpolation is used for the highest quality resizing
- No intermediate low-quality versions are created

### 4. Precise Positioning and Compositing

Each scaled image is precisely positioned on the output canvas:

```python
# 라벨 위치 계산
pos = label.mapTo(frame_widget, QtCore.QPoint(0, 0))

# 출력 이미지에서의 위치와 크기 계산
target_x = int(pos.x() * scale_x)
target_y = int(pos.y() * scale_y)
target_width = int(label.width() * scale_x)
target_height = int(label.height() * scale_y)

# 이미지 복사 with offset handling
if self.moved[current_mode][idx]:
    diff_x, diff_y = self.moved[current_mode][idx]
    x = int(diff_x * scale_x)
    y = int(diff_y * scale_y)
else:
    x = 0
    y = 0

# 이미지가 캔버스 범위 내에 있는 부분만 복사
y1 = max(label_y, int(target_y + y))
y2 = min(label_bottom, int(target_y + y + height))
x1 = max(label_x, int(target_x + x))
x2 = min(label_right, int(target_x + x + width))

if y2 > y1 and x2 > x1:
    # 원본 이미지에서 복사할 영역 계산
    img_y1 = max(0, int(-(target_y + y - label_y)))
    img_x1 = max(0, int(-(target_x + x - label_x)))
    img_y2 = img_y1 + (y2 - y1)
    img_x2 = img_x1 + (x2 - x1)

    # 이미지 복사
    result_image[y1:y2, x1:x2] = scaled_img[img_y1:img_y2, img_x1:img_x2]
```

This ensures that:
- Images are positioned exactly where they appear in the UI
- Drag offsets are preserved at full resolution
- Only visible portions are copied to avoid boundary errors

### 5. Frame Overlay Processing

Frame overlays are also processed at target resolution with proper alpha blending:

```python
# 프레임 이미지 추가
frame_path = self.frame_image_path[current_mode]
if os.path.exists(frame_path):
    stream = open(frame_path, 'rb')
    bytes = bytearray(stream.read())
    numpyarray = np.asarray(bytes, dtype=np.uint8)
    # IMREAD_UNCHANGED로 변경하여 알파 채널을 포함하여 로드
    frame = cv2.imdecode(numpyarray, cv2.IMREAD_UNCHANGED)
    if frame is not None:
        frame = cv2.resize(frame, (width_px, height_px), 
                         interpolation=cv2.INTER_LANCZOS4)
        
        # BGR 이미지로 변환
        if frame.shape[2] == 4:  # 알파 채널이 있는 경우
            # 알파 채널 분리
            alpha = frame[:, :, 3]
            frame_bgr = frame[:, :, :3]
            
            # 알파 채널을 0-1 범위로 정규화
            alpha = alpha.astype(float) / 255
            
            # 알파 블렌딩 수행
            for c in range(3):  # BGR 각 채널에 대해
                result_image[:, :, c] = (1 - alpha) * result_image[:, :, c] + alpha * frame_bgr[:, :, c]
```

This approach:
- Loads the original frame image with alpha channel preserved
- Resizes it directly to target resolution using LANCZOS4
- Performs proper alpha blending for transparent overlays

### 6. Text Rendering at High Resolution

Text is rendered at the appropriate size for the target DPI:

```python
# DPI 기반 스케일링 계산
screen = QtWidgets.QApplication.primaryScreen()
dpi_scale = screen.logicalDotsPerInch() / 96.0

# 실제 보이는 폰트 크기 계산 (DPI 스케일링 고려)
actual_font_size = int(orig_font_size * dpi_scale)

# 출력용 폰트 크기 계산 (실제 보이는 크기 기준)
font_size = int(actual_font_size * (target_dpi / 96.0))  # target_dpi는 1200

font = ImageFont.truetype(self.font_path, font_size)
```

Text rendering features:
- Font size is scaled appropriately for the target DPI
- Uses PIL's ImageFont for high-quality text rendering
- Preserves text styling (italic, alignment) from the UI
- Implements proper character positioning for Korean text

### 7. Lossless Output Encoding

The final image is saved as a PNG with lossless encoding:

```python
# 파일 저장
save_path, selected_filter = QtWidgets.QFileDialog.getSaveFileName(
    self, "Save Image", "", 
    "PNG Files (*.png);;JPEG Files (*.jpg *.jpeg);;All Files (*)"
)

if save_path:
    file_type = os.path.splitext(save_path)[1]
    ret, img_arr = cv2.imencode(file_type, result_image)
    if ret:
        with open(save_path, mode='w+b') as f:                
            img_arr.tofile(f)
```

## Key Technical Details

### 1. Direct High-Resolution Processing

The core principle is that all components are processed directly at the target resolution, avoiding any intermediate scaling that could introduce quality loss.

### 2. Separation of Concerns

Each component (images, frames, text) is processed independently at full resolution before being composited together, ensuring maximum quality for each element.

### 3. Precise Coordinate Mapping

All UI coordinates are mapped to output coordinates using precise scaling ratios, preserving the exact layout from the editor.

### 4. High-Quality Interpolation

LANCZOS4 interpolation is used throughout for the highest quality image resizing.

### 5. Alpha Channel Preservation

Frame overlays maintain their alpha channels throughout processing for proper transparency handling.

### 6. DPI-Aware Text Rendering

Text is rendered at the correct size for the target DPI while preserving styling from the UI.

## UI Integration

The export functionality is triggered by the download button in the UI:

```python
self.ui.download_btn.pressed.connect(self.export_image)
```

When pressed, the `export_image()` function processes all components and presents a file save dialog to the user.

## Conclusion

The original application achieves high-quality exports through:

1. **Direct High-Resolution Processing**: All components are rendered directly at the target resolution
2. **Quality-Preserving Scaling**: LANCZOS4 interpolation ensures the best possible resizing
3. **Precise Layout Preservation**: UI coordinates are accurately mapped to output coordinates
4. **Component Independence**: Each element is processed at full quality before compositing
5. **DPI-Aware Rendering**: Text and other elements scale appropriately for the target resolution
6. **Lossless Output**: PNG encoding preserves all image quality

This approach ensures that exported images maintain their quality regardless of the complexity of the composition or the amount of editing applied in the UI.