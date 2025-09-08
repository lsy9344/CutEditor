# 프레임 크기 결정 로직 문서

이 문서는 `original_source`의 소스 코드를 기반으로, 애플리케이션이 프레임 이미지 파일 이름에 따라 동적으로 위젯의 크기를 결정하고 UI를 전환하는 방식을 설명합니다.

## 1. 개요

애플리케이션은 사용자가 프레임 이미지를 선택하면, 해당 파일의 이름에 포함된 특정 키워드(예: `2_세로`, `4_가로`)를 감지합니다. 이 키워드를 기반으로 미리 정의된 UI 레이아웃(페이지)으로 전환하고, 해당 레이아웃의 크기에 맞춰 프레임 이미지를 리사이즈하여 화면에 표시합니다.

핵심 로직은 `original_source/basic.py`의 `select_frame` 함수에 있으며, UI 레이아웃은 `original_source/ui.ui` 파일에 `QStackedWidget`의 페이지들로 정의되어 있습니다.

## 2. 핵심 로직 및 구성 요소

### 2.1. 크기 결정 상수

`basic.py`의 `Program` 클래스 생성자(`__init__`)에는 다음과 같이 두 개의 핵심 크기 상수가 정의되어 있습니다. 이 값들은 UI(`ui.ui`)에 정의된 위젯들의 크기와 일치합니다.

- `self.px_15 = 719` (가로 모드 너비, 세로 모드 높이)
- `self.px_10 = 483` (가로 모드 높이, 세로 모드 너비)

```python
# original_source/basic.py

class Program(QtWidgets.QWidget):
    def __init__(self):
        # ... (생략) ...
        # 화면 DPI 설정
        self.px_15 = 719
        self.px_10 = 483
        self.width_px = self.px_15
        self.height_px = self.px_10
        # ... (생략) ...
```

### 2.2. UI 레이아웃 (`ui.ui`)

`ui.ui` 파일은 `QStackedWidget`을 포함하고 있으며, 이 위젯 안에 여러 개의 `QWidget` 페이지가 정의되어 있습니다. 각 페이지는 특정 프레임 레이아웃(예: 2분할 가로, 4분할 세로)을 나타내며, 크기가 고정되어 있습니다.

- **가로 모드 페이지 (719x483)**: `page_2frame_hor`, `page_4frame_hor`, `page_6frame_hor`, `page_9frame_hor`
- **세로 모드 페이지 (483x719)**: `page_2frame_ver`, `page_4frame_ver`, `page_6frame_ver`, `page_9frame_ver`

**예시: `page_2frame_hor` (2분할 가로) 위젯 정의**
```xml
<!-- original_source/ui.ui -->
<widget class="QWidget" name="page_2frame_hor">
 <property name="minimumSize">
  <size>
   <width>719</width>
   <height>483</height>
  </size>
 </property>
 <property name="maximumSize">
  <size>
   <width>719</width>
   <height>483</height>
  </size>
 </property>
 <!-- ... (내부 레이아웃) ... -->
</widget>
```

**예시: `page_2frame_ver` (2분할 세로) 위젯 정의**
```xml
<!-- original_source/ui.ui -->
<widget class="QWidget" name="page_2frame_ver">
 <property name="minimumSize">
  <size>
   <width>483</width>
   <height>719</height>
  </size>
 </property>
 <property name="maximumSize">
  <size>
   <width>483</width>
   <height>719</height>
  </size>
 </property>
 <!-- ... (내부 레이아웃) ... -->
</widget>
```

### 2.3. 동적 크기 결정 로직 (`select_frame` 함수)

`select_frame` 함수는 사용자가 선택한 프레임 이미지 파일의 이름을 분석하여 UI를 전환하고 크기를 설정합니다.

1.  `QtWidgets.QFileDialog.getOpenFileName`을 통해 사용자로부터 이미지 파일 경로를 받습니다.
2.  `os.path.basename`으로 파일 이름(`frame_name`)을 추출합니다.
3.  파일 이름에 포함된 키워드(예: "2_horizontal", "2_vertical")를 확인하여 `current_index`와 `isVertical` 플래그를 설정합니다. `current_index`는 `QStackedWidget`에서 보여줄 페이지의 인덱스입니다.
4.  `isVertical` 플래그 값에 따라 `self.width_px`와 `self.height_px`를 `719`와 `483`으로 스왑합니다.
5.  `cv2.resize`를 사용하여 선택된 프레임 이미지를 `(self.width_px, self.height_px)` 크기로 조절합니다.
6.  `self.frame_widgets[current_index]`를 통해 `ui.ui`에 정의된 해당 `QWidget` 페이지의 참조를 가져옵니다.
7.  `frame_widget.setFixedSize()`를 호출하여 위젯의 크기를 리사이즈된 프레임 이미지의 크기로 다시 한번 명시적으로 설정합니다.
8.  `self.ui.stackedWidget.setCurrentIndex(current_index)`를 호출하여 해당 페이지를 화면에 표시합니다.

```python
# original_source/basic.py

def select_frame(self):
    # ... (생략) ...
    file_path, _ = QtWidgets.QFileDialog.getOpenFileName(
        self, "프레임 이미지 선택", "", 
        "Image Files (*.png *.jpg *.jpeg)"
    )
    
    if file_path:
        # 파일 이름에 따라 current_index 설정
        frame_name = os.path.basename(file_path)
        current_index = -1
        frame_widget = None
        isVertical = False
        if "2_horizontal" in frame_name or "2_가로" in frame_name:
            current_index = 1
        elif "2_vertical" in frame_name or "2_세로" in frame_name:
            current_index = 2
            isVertical = True
        # ... (다른 프레임 개수 및 방향에 대한 elif 블록들) ...
        
        frame_widget = self.frame_widgets[current_index]
        if current_index == -1:
            self.ui.log_label.setText("파일 네이밍이 규약에 맞지 않습니다.")
            return
        
        # isVertical 플래그에 따라 너비/높이 값 설정
        self.width_px = self.px_15
        self.height_px = self.px_10
        if isVertical:
            self.width_px = self.px_10
            self.height_px = self.px_15
        
        # OpenCV로 프레임 이미지 로드 및 리사이즈
        # ...
        frame = cv2.resize(frame, (self.width_px, self.height_px), 
                                 interpolation=cv2.INTER_LANCZOS4)

        # ... (이미지를 QPixmap으로 변환하여 오버레이에 표시) ...

        # 위젯의 크기를 프레임 이미지 크기로 고정
        frame_widget.setFixedSize(frame.shape[1], frame.shape[0])
        self.ui.adjustSize()

        # 스택 위젯의 인덱스를 파일 이름에 따라 설정
        self.ui.stackedWidget.setCurrentIndex(current_index)
        # ... (생략) ...
```

## 3. 요약 테이블

다음은 파일 이름 키워드, 적용되는 크기, 그리고 활성화되는 UI 위젯 간의 관계를 요약한 표입니다.

| 파일 이름 포함 키워드 | `isVertical` | `width_px` | `height_px` | 활성화되는 `stackedWidget` 페이지 (`ui.ui`) | 페이지 크기 (WxH) |
| :--- | :---: | :---: | :---: | :--- | :---: |
| `2_horizontal`, `2_가로` | `False` | 719 | 483 | `page_2frame_hor` | 719 x 483 |
| `2_vertical`, `2_세로` | `True` | 483 | 719 | `page_2frame_ver` | 483 x 719 |
| `4_horizontal`, `4_가로` | `False` | 719 | 483 | `page_4frame_hor` | 719 x 483 |
| `4_vertical`, `4_세로` | `True` | 483 | 719 | `page_4frame_ver` | 483 x 719 |
| `6_horizontal`, `6_가로` | `False` | 719 | 483 | `page_6frame_hor` | 719 x 483 |
| `6_vertical`, `6_세로` | `True` | 483 | 719 | `page_6frame_ver` | 483 x 719 |
| `9_horizontal`, `9_가로` | `False` | 719 | 483 | `page_9frame_hor` | 719 x 483 |
| `9_vertical`, `9_세로` | `True` | 483 | 719 | `page_9frame_ver` | 483 x 719 |

