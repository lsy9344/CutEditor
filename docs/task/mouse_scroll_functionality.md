# Mouse Hover and Scroll Functionality Analysis

## Overview

This document provides a detailed analysis of how the original PySide2-based application implements the functionality where hovering over an image slot and scrolling affects only that specific image slot.

## Core Implementation

### 1. Event System Architecture

The application uses custom event filter functions to handle different types of user interactions:

```python
# In basic.py
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
```

### 2. Event Connection

In the `setup_events()` method, wheel events are connected to each image label:

```python
# In basic.py - setup_events method
for label_idx in self.image_labels:
    for idx, label in enumerate(self.image_labels[label_idx]):
        # ... other event connections ...
        
        # 휠 이벤트 설정
        wheelable(label).connect(lambda dir, i=idx, l=label: self.zoom_inout(i, l, dir))
```

### 3. Zoom Function Implementation

The `zoom_inout()` function handles the actual zooming operation for a specific image slot:

```python
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
```

## Key Technical Details

### 1. Per-Slot Data Management

The application maintains separate data structures for each image slot:

```python
# Scale values for each slot
self.scale = {
    0: [],
    1: ["100"] * 2,    # 2-slot template
    2: ["100"] * 2,    # 2-slot vertical template
    3: ["100"] * 4,    # 4-slot template
    # ... and so on for other templates
}

# Movement data for each slot
self.moved = {
    0: [],
    1: [None] * 2,
    2: [None] * 2,
    # ... and so on
}
```

### 2. Index-Based Operations

When a wheel event occurs:
1. The specific label that received the event is identified
2. The index of that label within its template is determined
3. Operations are performed only on the data corresponding to that index

### 3. Visual Feedback

The UI provides immediate feedback by:
- Updating the scale display (`scale_lineEdit`)
- Showing which image is being manipulated (`log_label`)
- Visually updating only the affected image slot

## UI Structure

The UI uses a `QStackedWidget` containing different templates:
- Each template page contains multiple `QLabel` widgets for image slots
- Each image slot label has:
  - Unique object name (e.g., `frame_2_hor_image1`, `frame_2_hor_image2`)
  - `OpenHandCursor` to indicate interactivity
  - "이미지를 선택하세요" placeholder text

## Event Flow

1. **Mouse Hover**: User moves mouse over a specific image slot label
2. **Wheel Scroll**: User scrolls the mouse wheel while hovering
3. **Event Capture**: The `wheelable` event filter captures the wheel event
4. **Signal Emission**: The filter emits a `scrolled` signal with the scroll direction
5. **Function Call**: The connected `zoom_inout` function is called with:
   - The slot index
   - The specific label object
   - Scroll direction
6. **Data Update**: Scale value for that specific slot is updated
7. **Visual Update**: Only that slot's image is redrawn with the new scale

## Technical Implementation Points

### 1. Lambda Function with Default Parameters

The event connection uses a lambda with default parameters to capture the correct index and label:

```python
wheelable(label).connect(lambda dir, i=idx, l=label: self.zoom_inout(i, l, dir))
```

This ensures that each connection has the correct values for `i` and `l`.

### 2. Template-Aware Operations

All operations consider the current template:

```python
current_mode = self.ui.stackedWidget.currentIndex()
```

This ensures that data operations affect only the currently visible template.

### 3. Independent State Management

Each image slot maintains its own:
- Scale value
- Position offset (`moved`)
- Image data
- File path

This independence allows each slot to be manipulated separately without affecting others.

## Conclusion

The original application achieves per-slot scroll functionality through:

1. **Individual Event Filters**: Each image slot has its own wheel event filter
2. **Index-Based Data Access**: Operations target specific indices in data arrays
3. **Template Context Awareness**: All operations are aware of the current template
4. **Selective Visual Updates**: Only the affected slot is redrawn
5. **Independent State Tracking**: Each slot maintains its own transformation state

This architecture ensures that scrolling over one image slot affects only that slot, providing an intuitive user experience where each image can be independently scaled and positioned.