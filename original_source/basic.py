# _*_ coding: utf-8 _*_

import sys
import os
from PySide2 import QtCore, QtUiTools, QtWidgets, QtGui
import cv2
import numpy as np
import math
from PIL import ImageFont, ImageDraw, Image

PWD = os.path.dirname(os.path.abspath(__file__))

def clickable(widget):
    class Filter(QtCore.QObject):
        clicked = QtCore.Signal()
        
        def eventFilter(self, obj, event):
            if event.type() == QtCore.QEvent.MouseButtonRelease:
                if obj.rect().contains(event.pos()):
                    self.clicked.emit()
                    return True
            return False
    
    filter = Filter(widget)
    widget.installEventFilter(filter)
    return filter.clicked

def draggable(widget):
    class Filter(QtCore.QObject):
        drag_started = QtCore.Signal(int, int)
        drag_moved = QtCore.Signal(int, int)
        drag_ended = QtCore.Signal(int, int)
        
        def eventFilter(self, obj, event):
            if event.type() == QtCore.QEvent.MouseButtonPress:
                self.drag_start_pos = event.pos()
                self.drag_started.emit(event.pos().x(), event.pos().y())
            elif event.type() == QtCore.QEvent.MouseMove and event.buttons() == QtCore.Qt.LeftButton:
                self.drag_moved.emit(event.pos().x(), event.pos().y())
            elif event.type() == QtCore.QEvent.MouseButtonRelease:
                self.drag_ended.emit(event.pos().x(), event.pos().y())
            return False
    
    filter = Filter(widget)
    widget.installEventFilter(filter)
    return filter.drag_started, filter.drag_moved, filter.drag_ended

def wheelable(widget):
    class Filter(QtCore.QObject):
        scrolled = QtCore.Signal(int)

        def eventFilter(self, obj, event):
            if event.type() == QtCore.QEvent.Wheel:
                delta = event.angleDelta().y()
                self.scrolled.emit(delta)  # 휠 방향(양수: 위, 음수: 아래)을 emit
                return True
            return super().eventFilter(obj, event)

    filter = Filter(widget)
    widget.installEventFilter(filter)
    return filter.scrolled

class Program(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        if getattr(sys, 'frozen', False):
            application_path = sys._MEIPASS
        else:
            application_path = os.path.dirname(os.path.abspath(__file__))
        
        ui_file = os.path.join(application_path, "ui.ui")
        self.ui = QtUiTools.QUiLoader().load(ui_file, None)
        self.ui.show()

        self.ui.stackedWidget.setCurrentIndex(0)
        self.ui.version_label.setText("v1.0.0")
        
        # 폰트 파일 등록
        self.font_path = os.path.join(application_path, "font.ttf")
        font_id = QtGui.QFontDatabase.addApplicationFont(self.font_path)
        font_families = QtGui.QFontDatabase.applicationFontFamilies(font_id)
        self.font = font_families[0]

        self.frame_widgets = [
            None,
            self.ui.page_2frame_hor,
            self.ui.page_2frame_ver,
            self.ui.page_4frame_hor,
            self.ui.page_4frame_ver,
            self.ui.page_6frame_hor,
            self.ui.page_6frame_ver,
            self.ui.page_9frame_hor,
            self.ui.page_9frame_ver
        ]
        self.frame_image_path = [""] * 9
        self.image_labels = {
            0 : [],
            1: [
                self.ui.frame_2_hor_image1, self.ui.frame_2_hor_image2
            ],
            2: [
                self.ui.frame_2_ver_image1, self.ui.frame_2_ver_image2
            ],
            3: [
                self.ui.frame_4_hor_image1, self.ui.frame_4_hor_image2,
                self.ui.frame_4_hor_image3, self.ui.frame_4_hor_image4
            ],
            4: [
                self.ui.frame_4_ver_image1, self.ui.frame_4_ver_image2,
                self.ui.frame_4_ver_image3, self.ui.frame_4_ver_image4
            ],
            5: [
                self.ui.frame_6_hor_image1, self.ui.frame_6_hor_image2,
                self.ui.frame_6_hor_image3, self.ui.frame_6_hor_image4,
                self.ui.frame_6_hor_image5, self.ui.frame_6_hor_image6
            ],
            6: [
                self.ui.frame_6_ver_image1, self.ui.frame_6_ver_image2,
                self.ui.frame_6_ver_image3, self.ui.frame_6_ver_image4,
                self.ui.frame_6_ver_image5, self.ui.frame_6_ver_image6
            ],
            7: [
                self.ui.frame_9_hor_image1, self.ui.frame_9_hor_image2, self.ui.frame_9_hor_image3,
                self.ui.frame_9_hor_image4, self.ui.frame_9_hor_image5, self.ui.frame_9_hor_image6,
                self.ui.frame_9_hor_image7, self.ui.frame_9_hor_image8, self.ui.frame_9_hor_image9
            ],
            8: [
                self.ui.frame_9_ver_image1, self.ui.frame_9_ver_image2, self.ui.frame_9_ver_image3,
                self.ui.frame_9_ver_image4, self.ui.frame_9_ver_image5, self.ui.frame_9_ver_image6,
                self.ui.frame_9_ver_image7, self.ui.frame_9_ver_image8, self.ui.frame_9_ver_image9,
            ]
        }
        self.text_labels = [
            None,
            [self.ui.frame_2_hor_label_1, self.ui.frame_2_hor_label_2, self.ui.frame_2_hor_label_3],
            [self.ui.frame_2_ver_label],
            [self.ui.frame_4_hor_label_1, self.ui.frame_4_hor_label_2, self.ui.frame_4_hor_label_3],
            [self.ui.frame_4_ver_label],
            [self.ui.frame_6_hor_label_1, self.ui.frame_6_hor_label_2, self.ui.frame_6_hor_label_3],
            [self.ui.frame_6_ver_label],
            [self.ui.frame_9_hor_label_1, self.ui.frame_9_hor_label_2, self.ui.frame_9_hor_label_3],
            [self.ui.frame_9_ver_label]
        ]

        # OpenCV 이미지 저장용 리스트
        self.images = { # OpenCV 이미지 저장
            0: [],
            1: [None] * 2,
            2: [None] * 2,
            3: [None] * 4,
            4: [None] * 4,
            5: [None] * 6,
            6: [None] * 6,
            7: [None] * 9,
            8: [None] * 9
        }
        self.image_paths = {
            0: [],
            1: [None] * 2,
            2: [None] * 2,
            3: [None] * 4,
            4: [None] * 4,
            5: [None] * 6,
            6: [None] * 6,
            7: [None] * 9,
            8: [None] * 9
        }
        self.start_pos = None
        self.is_move_mode = False
        self.moved = {
            0: [],
            1: [None] * 2,
            2: [None] * 2,
            3: [None] * 4,
            4: [None] * 4,
            5: [None] * 6,
            6: [None] * 6,
            7: [None] * 9,
            8: [None] * 9
        }
        self.scale = {
            0: [],
            1: ["100"] * 2,
            2: ["100"] * 2,
            3: ["100"] * 4,
            4: ["100"] * 4,
            5: ["100"] * 6,
            6: ["100"] * 6,
            7: ["100"] * 9,
            8: ["100"] * 9
        }
        self.clicked_label = None

        # 화면 DPI 설정
        self.px_15 = 719
        self.px_10 = 483
        self.width_px = self.px_15
        self.height_px = self.px_10

        # 프레임 오버레이 라벨 생성
        self.frame_overlays = [None] * 9
    
        # 오버레이 라벨 설정
        for index, widget in enumerate(self.frame_widgets):
            if index == 0:
                continue

            overlay = QtWidgets.QLabel(widget)
            overlay.setGeometry(widget.rect())
            overlay.setAttribute(QtCore.Qt.WA_TransparentForMouseEvents)  # 마우스 이벤트 투과
            overlay.setVisible(True)  # 명시적으로 보이도록 설정
            overlay.raise_()  # 항상 최상위로 표시
            self.frame_overlays[index] = overlay

        # 이벤트 연결
        self.setup_events()

    def setup_events(self):
        '''
        이벤트 설정하는 함수
        '''
        self.ui.frame_btn.clicked.connect(self.select_frame)
        
        # 라벨 이벤트 설정
        for label_idx in self.image_labels:
            for idx, label in enumerate(self.image_labels[label_idx]):
                drag_started, drag_moved, drag_ended = draggable(label)
                drag_started.connect(lambda x, y, i=idx: self.drag_started(i, x, y))
                drag_moved.connect(lambda x, y, i=idx: self.move_image(i, x, y))
                drag_ended.connect(lambda: self.drag_ended())
            
                # 클릭 이벤트 설정
                clickable(label).connect(lambda i=idx, l=label: self.select_image(i, l))

                # 휠 이벤트 설정
                wheelable(label).connect(lambda dir, i=idx, l=label: self.zoom_inout(i, l, dir))

        self.ui.scale_lineEdit.returnPressed.connect(self.scale_changed)
        self.ui.text_apply_btn.pressed.connect(self.apply_btn_clicked)
        self.ui.download_btn.pressed.connect(self.export_image)
        self.ui.init_btn.pressed.connect(self.init)
        self.ui.init_image_btn.pressed.connect(self.image_init)

    def init(self):
        '''
        초기화 함수
        '''
        current_mode = self.ui.stackedWidget.currentIndex()
        image_num = len(self.image_labels[current_mode])
        
        # 현재 모드의 이미지 관련 데이터만 초기화
        self.images[current_mode] = [None] * image_num
        self.image_paths[current_mode] = [None] * image_num
        self.moved[current_mode] = [None] * image_num
        self.scale[current_mode] = ["100"] * image_num
        
        # 현재 모드의 이미지 라벨만 초기화
        for label in self.image_labels[current_mode]:
            label.clear()
            label.setText("이미지를 선택하세요")
        
        # 현재 모드의 프레임 이미지만 초기화
        self.frame_image_path[current_mode] = ""
        self.frame_overlays[current_mode].clear()

        # 현재 모드의 문구 라벨만 초기화
        for label in self.text_labels[current_mode]:
            label.setText("")
            font = QtGui.QFont(self.font, 12, QtGui.QFont.Normal, True)
            label.setFont(font)

        # UI 초기화
        self.ui.scale_lineEdit.setText("")
        self.ui.scale_lineEdit.setEnabled(False)
        self.ui.log_label.setText("")
        self.ui.textEdit.setText("")
        self.ui.textEdit.setEnabled(False)
        self.ui.font_lineEdit.setText("12")
        self.ui.font_lineEdit.setEnabled(False)
        self.clicked_label = None
    
    def image_init(self):
        '''
        선택한 이미지를 초기화하는 함수
        '''
        if not self.clicked_label:
            return
        
        current_mode = self.ui.stackedWidget.currentIndex()
        index = self.image_labels[current_mode].index(self.clicked_label)

        self.images[current_mode][index] = None
        self.image_paths[current_mode][index] = None
        self.moved[current_mode][index] = None
        self.scale[current_mode][index] = "100"

        self.clicked_label.clear()
        self.clicked_label.setText("이미지를 선택하세요")

        self.ui.scale_lineEdit.setText("")
        self.ui.scale_lineEdit.setEnabled(False)
        self.ui.log_label.setText("")

    def cv_to_pixmap(self, cv_img):
        '''
        OpenCV 이미지를 QPixmap으로 변환하는 함수
        '''
        if cv_img is None:
            return None
        height, width, channel = cv_img.shape
        bytes_per_line = 3 * width
        rgb_image = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
        q_img = QtGui.QImage(rgb_image.data, width, height, bytes_per_line, QtGui.QImage.Format_RGB888)
        return QtGui.QPixmap.fromImage(q_img)

    def create_canvas(self, width, height):
        '''
        투명한 배경의 캔버스를 생성하는 함수
        '''
        canvas = np.zeros((height, width, 3), dtype=np.uint8)
        canvas.fill(255)  # 흰색 배경
        return canvas
    
    def select_frame(self):
        '''
        프레임 이미지를 선택하는 함수
        '''
        self.ui.log_label.setText("")
        self.ui.scale_lineEdit.setEnabled(False)
        self.ui.scale_lineEdit.setText("")
        self.ui.textEdit.setText("")
        self.ui.font_lineEdit.setText("12")
        self.clicked_label = None

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
            elif "4_horizontal" in frame_name or "4_가로" in frame_name:
                current_index = 3
            elif "4_vertical" in frame_name or "4_세로" in frame_name:
                current_index = 4
                isVertical = True
            elif "6_horizontal" in frame_name or "6_가로" in frame_name:
                current_index = 5
            elif "6_vertical" in frame_name or "6_세로" in frame_name:
                current_index = 6
                isVertical = True
            elif "9_horizontal" in frame_name or "9_가로" in frame_name:
                current_index = 7
            elif "9_vertical" in frame_name or "9_세로" in frame_name:
                current_index = 8
                isVertical = True
            
            frame_widget = self.frame_widgets[current_index]
            if current_index == -1:
                self.ui.log_label.setText("파일 네이밍이 규약에 맞지 않습니다.")
                return
            
            self.width_px = self.px_15
            self.height_px = self.px_10
            if isVertical:
                self.width_px = self.px_10
                self.height_px = self.px_15
            
            # OpenCV로 프레임 이미지 로드 (알파 채널 포함)
            stream = open(file_path, 'rb')
            bytes = bytearray(stream.read())
            numpyarray = np.asarray(bytes, dtype=np.uint8)
            frame = cv2.imdecode(numpyarray, cv2.IMREAD_UNCHANGED)
            if frame is not None:
                frame = cv2.resize(frame, (self.width_px, self.height_px), 
                                     interpolation=cv2.INTER_LANCZOS4)

                # 알파 채널이 있는 경우 크기 조정
                if frame.shape[2] == 4:
                    # QImage로 변환 시 알파 채널 포함
                    height, width, channel = frame.shape
                    bytes_per_line = 4 * width
                    q_img = QtGui.QImage(frame.data, width, height, bytes_per_line, QtGui.QImage.Format_RGBA8888)
                else:
                    # 알파 채널이 없는 경우 기존 방식
                    height, width, channel = frame.shape
                    bytes_per_line = 3 * width
                    rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    q_img = QtGui.QImage(rgb_image.data, width, height, bytes_per_line, QtGui.QImage.Format_RGB888)
                
                # 프레임 오버레이에 표시
                overlay = self.frame_overlays[current_index]
                overlay.setPixmap(QtGui.QPixmap.fromImage(q_img))
                overlay.raise_()

                # 문구 라벨을 최상단으로 올린다
                for label in self.text_labels[current_index]:
                    label.raise_()

                frame_widget.setFixedSize(frame.shape[1], frame.shape[0])
                self.ui.adjustSize()

            # 스택 위젯의 인덱스를 파일 이름에 따라 설정
            self.ui.stackedWidget.setCurrentIndex(current_index)
            self.frame_image_path[current_index] = file_path

            font = QtGui.QFont(self.font, 12, QtGui.QFont.Normal, True)
            for label in self.text_labels[current_index]:
                label.setFont(font)
                label.setText("")

            self.ui.textEdit.setEnabled(True)
            self.ui.font_lineEdit.setEnabled(True)

    def select_image(self, index, label):
        '''
        이미지를 선택하는 함수
        '''
        current_mode = self.ui.stackedWidget.currentIndex()

        if self.images[current_mode][index] is not None:
            return

        file_path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "이미지 선택", "", 
            "Image Files (*.png *.jpg *.jpeg)"
        )
        
        if file_path:
            self.image_paths[current_mode][index] = file_path

            # OpenCV로 이미지 로드
            stream = open(file_path, 'rb')
            bytes = bytearray(stream.read())
            numpyarray = np.asarray(bytes, dtype=np.uint8)
            cv_img = cv2.imdecode(numpyarray, cv2.IMREAD_COLOR)

            if cv_img is not None:
                self.images[current_mode][index] = cv_img.copy()

                 # 라벨과 이미지의 크기 비율 계산
                label_width = label.width()
                label_height = label.height()
                img_width = cv_img.shape[1]
                img_height = cv_img.shape[0]
                
                # 가로, 세로 비율 중 더 작은 값을 선택하여 scale 계산
                width_ratio = (label_width / img_width) * 100
                height_ratio = (label_height / img_height) * 100
                scale = min(width_ratio, height_ratio)
                
                # 소수점 첫째 자리까지 반올림
                scale = math.ceil(scale)
                
                # scale이 100을 넘지 않도록 조정
                if scale > 100:
                    scale = 100
                
                self.scale[current_mode][index] = str(scale)
                self.clicked_label = label
                self.moved[current_mode][index] = None

                self.ui.scale_lineEdit.setText(str(scale))
                self.ui.scale_lineEdit.setEnabled(True)
                
                self.set_image_to_label(index)
    
    def zoom_inout(self, index, label, dir):
        '''
        사진을 줌인/아웃하는 함수
        '''
        if self.images[index] is None:
            return
        
        current_mode = self.ui.stackedWidget.currentIndex()
        
        scale = float(self.scale[current_mode][index])

        if dir > 0:
            scale += 1
        else:
            scale -= 1
            if scale == 0:
                scale = 1
        
        self.scale[current_mode][index] = str(scale)
        self.clicked_label = label
        self.ui.scale_lineEdit.setText(str(scale))
        self.ui.scale_lineEdit.setEnabled(True)

        image_index = index + 1
        self.ui.log_label.setText("Image {} selected".format(image_index))

        self.set_image_to_label(index)

    def set_image_to_label(self, index):
        '''
        이미지를 라벨에 표시하는 함수
        '''
        current_mode = self.ui.stackedWidget.currentIndex()

        label = self.image_labels[current_mode][index]
        cv_img = self.images[current_mode][index]
        if cv_img is None:
            return

        # 스케일 적용
        scale_ratio = float(self.scale[current_mode][index]) * 0.01
        width = int(cv_img.shape[1] * scale_ratio)
        height = int(cv_img.shape[0] * scale_ratio)
        scaled_img = cv2.resize(cv_img, (width, height), interpolation=cv2.INTER_LANCZOS4)

        # 라벨 크기의 캔버스 생성
        canvas = self.create_canvas(label.width(), label.height())

        # 이동값 적용 또는 왼쪽 정렬
        if self.moved[current_mode][index]:
            diff_x, diff_y = self.moved[current_mode][index]
            x = diff_x
            y = diff_y
        else:
            x = 0
            y = 0

        # 이미지를 캔버스에 복사
        try:
            # 이미지가 캔버스 범위 내에 있는 부분만 복사
            y1 = max(0, int(y))
            y2 = min(label.height(), int(y + height))
            x1 = max(0, int(x))
            x2 = min(label.width(), int(x + width))

            if y2 > y1 and x2 > x1:
                # 원본 이미지에서 복사할 영역 계산
                img_y1 = max(0, -int(y))
                img_x1 = max(0, -int(x))
                img_y2 = img_y1 + (y2 - y1)
                img_x2 = img_x1 + (x2 - x1)

                canvas[y1:y2, x1:x2] = scaled_img[img_y1:img_y2, img_x1:img_x2]
            
            # 중앙선 그리기
            # 가로 중앙선
            center_y = label.height() // 2
            cv2.line(canvas, 
                    (0, center_y), 
                    (label.width(), center_y), 
                    (0, 0, 255),  # BGR 색상 (빨간색)
                    1)  # 선 두께
            
            # 세로 중앙선
            center_x = label.width() // 2
            cv2.line(canvas, 
                    (center_x, 0), 
                    (center_x, label.height()), 
                    (0, 0, 255),  # BGR 색상 (빨간색)
                    1)  # 선 두께
        except ValueError as e:
            print(f"Error copying image: {e}")

        # OpenCV 이미지를 QPixmap으로 변환하여 라벨에 표시
        pixmap = self.cv_to_pixmap(canvas)
        label.setPixmap(pixmap)
        label.update()

    def drag_started(self, index, x, y):
        '''
        이미지 드래그 앤 드롭을 시작했을 때 실행되는 함수
        '''
        current_mode = self.ui.stackedWidget.currentIndex()

        self.start_pos = (x, y)
        self.is_move_mode = True
        self.clicked_label = self.image_labels[current_mode][index]
        
        # 스케일 표시 업데이트
        image_index = index + 1
        self.ui.log_label.setText("Image {} selected".format(image_index))
        self.ui.scale_lineEdit.setEnabled(True)
        self.ui.scale_lineEdit.setText(self.scale[current_mode][index])

    def move_image(self, index, x, y):
        '''
        이미지를 이동시키는 함수
        '''
        current_mode = self.ui.stackedWidget.currentIndex()

        if not self.is_move_mode or self.start_pos is None:
            return

        # 이동 거리 계산
        diff_x = x - self.start_pos[0]
        diff_y = y - self.start_pos[1]

        if self.moved[current_mode][index] is None:
            # 처음 이동하는 경우
            self.moved[current_mode][index] = (diff_x, diff_y)
        else:
            # 기존 이동값에 추가
            prev_x, prev_y = self.moved[current_mode][index]
            self.moved[current_mode][index] = (prev_x + diff_x, prev_y + diff_y)

        self.start_pos = (x, y)
        self.set_image_to_label(index)

    def drag_ended(self):
        '''
        이미지 드래그 앤 드롭을 종료했을 때 실행되는 함수
        '''
        self.is_move_mode = False
        self.start_pos = None

    def scale_changed(self):
        '''
        scale 값이 변경되었을 때 실행되는 함수
        선택한 이미지의 scale을 조정하여 다시 보여준다.
        '''
        current_mode = self.ui.stackedWidget.currentIndex()

        self.ui.log_label.setText("")

        if self.clicked_label is None:
            return

        try:
            scale_value = self.ui.scale_lineEdit.text()
            scale_float = float(scale_value)
            if scale_float <= 0:
                self.ui.log_label.setText("양수를 입력해 주세요")
                raise ValueError("Scale must be positive")

            # 선택된 라벨의 인덱스 찾기
            index = self.image_labels[current_mode].index(self.clicked_label)
            self.scale[current_mode][index] = scale_value
            self.moved[current_mode][index] = None
            self.set_image_to_label(index)

        except (ValueError, IndexError) as e:
            print(f"Error in scale_changed: {e}")

    def apply_btn_clicked(self):
        '''
        Apply 버튼이 눌렸을 때 실행되는 함수
        '''
        current_mode = self.ui.stackedWidget.currentIndex()

        self.ui.log_label.setText("")

        try:
            font_value = self.ui.font_lineEdit.text()
            font_int = int(font_value)
            if font_int <= 0:
                self.ui.log_label.setText("양수를 입력해 주세요")
                raise ValueError("Scale must be positive")
            
            # 디스플레이 DPI 스케일링 고려
            screen = QtWidgets.QApplication.primaryScreen()
            dpi_scale = screen.logicalDotsPerInch() / 96.0  # 96은 기본 DPI

            # DPI 스케일링을 고려한 폰트 크기 계산
            scaled_font_size = int(font_int / dpi_scale)

            font = QtGui.QFont(self.font, scaled_font_size, QtGui.QFont.Normal, True)
            for label in self.text_labels[current_mode]:
                label.setFont(font)

        except (ValueError, IndexError) as e:
            print(f"Error in scale_changed: {e}")
            return                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       

        text = self.ui.textEdit.toPlainText()

        if self.width_px == self.px_15: # 가로 방향
            text_split = text.split('\n')
            for idx, label in enumerate(self.text_labels[current_mode]):
                if idx < len(text_split):
                    result = "\n".join(list(text_split[idx]))
                    label.setText(result)
        else:
            label = self.text_labels[current_mode][0]
            label.setText(text)

    def export_image(self):
        '''
        이미지를 추출하는 함수
        '''
        try:
            self.ui.log_label.setText("")
            current_mode = self.ui.stackedWidget.currentIndex()

            # 고해상도 설정
            target_dpi = 1200
            current_dpi = QtGui.QGuiApplication.primaryScreen().logicalDotsPerInch()
            dpi_ratio = target_dpi / current_dpi
            width_px = int((15 * target_dpi) / 2.54)
            height_px = int((10 * target_dpi) / 2.54)
            if self.width_px == self.px_10: # 세로 방향
                width_px = int((10 * target_dpi) / 2.54)
                height_px = int((15 * target_dpi) / 2.54)
            
            # 결과 이미지 생성
            result_image = self.create_canvas(width_px, height_px)

            # 화면 크기와 출력 크기의 비율 계산
            scale_x = width_px / self.width_px
            scale_y = height_px / self.height_px

            frame_widget = self.frame_widgets[current_mode]

            for idx, label in enumerate(self.image_labels[current_mode]):
                if self.images[current_mode][idx] is None:
                    continue  # 이미지가 없으면 건너뛰기

                cv_img = self.images[current_mode][idx]
                
                # 스케일 적용
                scale_ratio = float(self.scale[current_mode][idx]) * 0.01
                width = int(cv_img.shape[1] * scale_ratio * scale_x)
                height = int(cv_img.shape[0] * scale_ratio * scale_y)
                scaled_img = cv2.resize(cv_img, (width, height), interpolation=cv2.INTER_LANCZOS4)

                # 라벨 위치 계산
                pos = label.mapTo(
                    frame_widget, 
                    QtCore.QPoint(0, 0)
                )
                
                # 출력 이미지에서의 위치와 크기 계산
                target_x = int(pos.x() * scale_x)
                target_y = int(pos.y() * scale_y)
                target_width = int(label.width() * scale_x)
                target_height = int(label.height() * scale_y)

                # 이미지 복사 (라벨에 보여지는 부분만)
                try:
                    # 라벨의 경계 계산 (스케일 적용)
                    label_x = int(pos.x() * scale_x)
                    label_y = int(pos.y() * scale_y)
                    label_right = label_x + int(label.width() * scale_x)
                    label_bottom = label_y + int(label.height() * scale_y)

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

                except ValueError as e:
                    print(f"Error copying image {idx}: {e}")

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
                    else:  # 알파 채널이 없는 경우
                        # 단순히 프레임으로 덮어쓰기
                        result_image = frame.copy()
            
            # 텍스트 추가
            if self.width_px == self.px_15: # 가로 방향
                text_labels = self.text_labels[current_mode]
                for text_label in text_labels:
                    text = text_label.text()
                    if text:
                        # 텍스트 라벨의 위치 및 크기 계산
                        target_width = int(text_label.width() * scale_x)    # 텍스트 라벨의 가로 (스케일 적용)
                        target_height = int(text_label.height() * scale_y)  # 텍스트 라벨의 세로 (스케일 적용)
                        text_pos = text_label.mapTo(frame_widget, QtCore.QPoint(0, 0))
                        text_x = int(text_pos.x() * scale_x)
                        text_y = int(text_pos.y() * scale_y)

                        # 한글 폰트 설정
                        orig_font_size = text_label.font().pointSize()
                        
                        # DPI 기반 스케일링 계산
                        screen = QtWidgets.QApplication.primaryScreen()
                        dpi_scale = screen.logicalDotsPerInch() / 96.0
                        
                        # 실제 보이는 폰트 크기 계산 (DPI 스케일링 고려)
                        actual_font_size = int(orig_font_size * dpi_scale)
                        
                        # 출력용 폰트 크기 계산 (실제 보이는 크기 기준)
                        font_size = int(actual_font_size * (target_dpi / 96.0))  # target_dpi는 1200
                        
                        font = ImageFont.truetype(self.font_path, font_size)

                        # OpenCV 이미지를 PIL로 변환
                        result_image_pil = Image.fromarray(cv2.cvtColor(result_image, cv2.COLOR_BGR2RGB))

                        # 텍스트를 줄 단위로 분리
                        lines = text.split('\n')
                        
                        # 전체 높이 계산 (모든 줄의 높이 합)
                        total_text_height = 0
                        line_heights = []
                        for line in lines:
                            line_height = len(line) * int(font_size * 1.2)  # 줄 간격
                            line_heights.append(line_height)
                            total_text_height += line_height

                        # 수직 중앙 정렬을 위한 시작 y 위치 계산
                        start_y = (target_height - total_text_height) / 2
                        current_y = start_y
                        
                        # 각 줄에 대해 처리
                        for line_idx, line in enumerate(lines):
                            # 각 줄의 문자를 세로로 그리기
                            for char_idx, char in enumerate(line):
                                # 현재 문자의 크기 계산
                                bbox = font.getbbox(char)
                                char_width = bbox[2] - bbox[0]
                                char_height = bbox[3] - bbox[1]
                                
                                # 라벨 위치에 따라 정렬 방식 다르게 적용
                                label_index = self.text_labels[current_mode].index(text_label)
                                if label_index == 0:  # 첫 번째 라벨 - 오른쪽 정렬
                                    x_position = text_x + (target_width - char_width)
                                elif label_index == 1:  # 두 번째 라벨 - 중앙 정렬
                                    x_position = text_x + (target_width - char_width) / 2
                                else:  # 세 번째 라벨 - 왼쪽 정렬
                                    x_position = text_x

                                y_position = current_y + (char_idx * int(font_size * 1.2))
                                
                                # 문자 그리기 (기울임 효과 적용)
                                padding = int(font_size * 0.3)
                                temp_img = Image.new('RGBA', 
                                                   (int(char_width * 2), int(font_size * 1.5)),  # 임시 이미지 크기 조정
                                                   (255, 255, 255, 0))
                                temp_draw = ImageDraw.Draw(temp_img)
                                
                                # 임시 이미지에 문자 그리기
                                temp_draw.text((padding, padding/2), char, font=font, fill=(0, 0, 0))
                                
                                # 기울임 변환 행렬 (shear transform)
                                shear_factor = 0.3  # 기울기 유지
                                temp_img = temp_img.transform(
                                    temp_img.size,
                                    Image.AFFINE,
                                    (1, shear_factor, 0, 0, 1, 0),
                                    Image.BICUBIC
                                )
                                
                                # 기울어진 문자를 원본 이미지에 합성 (위치 조정)
                                paste_x = max(0, int(x_position - padding))  # 왼쪽으로 이동 감소
                                paste_y = max(0, int(y_position))
                                result_image_pil.paste(temp_img, (paste_x, paste_y), temp_img)
                            
                            # 다음 줄의 시작 y 위치 업데이트
                            current_y += line_heights[line_idx] + orig_font_size  # 줄 간격 추가

                        # PIL 이미지를 OpenCV로 다시 변환
                        result_image = cv2.cvtColor(np.array(result_image_pil), cv2.COLOR_RGB2BGR)
            else:
                text_label = self.text_labels[current_mode][0]
                text = text_label.text()
                if text:
                    # 텍스트 라벨의 위치 및 크기 계산
                    target_width = int(text_label.width() * scale_x)
                    target_height = int(text_label.height() * scale_y)
                    text_pos = text_label.mapTo(frame_widget, QtCore.QPoint(0, 0))
                    text_x = int(text_pos.x() * scale_x)
                    text_y = int(text_pos.y() * scale_y)

                    # 한글 폰트 설정
                    orig_font_size = text_label.font().pointSize()

                    # DPI 기반 스케일링 계산
                    screen = QtWidgets.QApplication.primaryScreen()
                    dpi_scale = screen.logicalDotsPerInch() / 96.0
                        
                    # 실제 보이는 폰트 크기 계산 (DPI 스케일링 고려)
                    actual_font_size = int(orig_font_size * dpi_scale)
                        
                    # 출력용 폰트 크기 계산 (실제 보이는 크기 기준)
                    font_size = int(actual_font_size * (target_dpi / 96.0))  # target_dpi는 1200

                    font = ImageFont.truetype(self.font_path, font_size)
                        
                    padding = int(font_size)
                    
                    # OpenCV 이미지를 PIL로 변환
                    result_image_pil = Image.fromarray(cv2.cvtColor(result_image, cv2.COLOR_BGR2RGB))

                    lines = text.split('\n')
                    line_height = font_size + orig_font_size  # 줄 간격 조정
                    
                    # 텍스트 블록을 라벨 내에서 수직 중앙 정렬
                    start_y = text_y + int(font_size * 0.2)
                    
                    # 각 줄의 텍스트 그리기
                    for i, line in enumerate(lines):
                        # 텍스트 크기 계산
                        bbox = font.getbbox(line)
                        text_width = bbox[2] - bbox[0]
                        
                        # 기울어진 텍스트를 위한 더 넓은 임시 이미지 생성
                        temp_width = int(text_width * 1.5)  # 기울기를 위한 여유 공간
                        temp_img = Image.new('RGBA', 
                                           (temp_width, int(font_size * 2)),
                                           (255, 255, 255, 0))
                        temp_draw = ImageDraw.Draw(temp_img)
                        
                        # 임시 이미지의 중앙에 텍스트 그리기
                        temp_x = (temp_width - text_width) // 2
                        temp_draw.text((temp_x, padding/2), line, font=font, fill=(0, 0, 0))
                        
                        # 기울임 변환 행렬 적용
                        shear_factor = 0.3
                        temp_img = temp_img.transform(
                            temp_img.size,
                            Image.AFFINE,
                            (1, shear_factor, 0, 0, 1, 0),
                            Image.BICUBIC
                        )
                        
                        # 기울어진 텍스트의 실제 너비 계산
                        temp_array = np.array(temp_img)
                        non_empty = np.where(temp_array[:,:,3] > 0)
                        if len(non_empty[1]) > 0:
                            left_edge = non_empty[1].min()
                            right_edge = non_empty[1].max()
                            actual_width = right_edge - left_edge
                            
                            # 최종 이미지에서의 위치 계산 (중앙 정렬)
                            x_position = text_x + (target_width - actual_width) // 2
                            # left_edge만큼 왼쪽으로 이동하여 보정
                            x_position -= left_edge
                        else:
                            x_position = text_x
                            
                        y_position = start_y + (i * line_height)
                        
                        # 기울어진 텍스트를 원본 이미지에 합성
                        result_image_pil.paste(temp_img, (int(x_position), int(y_position)), temp_img)

                    # PIL 이미지를 OpenCV로 다시 변환
                    result_image = cv2.cvtColor(np.array(result_image_pil), cv2.COLOR_RGB2BGR)

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

                self.ui.log_label.setText("이미지를 저장했습니다.")

        except Exception as e:
            print(e)
            self.ui.log_label.setText("이미지 저장 중 오류가 발생했습니다.")

if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    win = Program()
    sys.exit(app.exec_())