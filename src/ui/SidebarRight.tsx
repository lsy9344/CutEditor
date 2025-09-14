import React, { useState, useRef } from "react";

export type SidebarRightProps = {
  selectedText?: {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
  };
  onTextInsert?: (textData: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
  }) => void;
  onTextUpdate?: (textId: string, updates: Partial<{
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
  }>) => void;
  onExport?: () => void;
};

export const SidebarRight: React.FC<SidebarRightProps> = ({ 
  selectedText,
  onTextInsert,
  onTextUpdate,
  onExport
}) => {
  const [textInput, setTextInput] = useState("");
  const [textSize, setTextSize] = useState(16);
  const [isItalic, setIsItalic] = useState(false);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontColor, setFontColor] = useState("#000000");
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // 선택된 텍스트의 속성을 표시
  const displayedTextSize = selectedText?.fontSize ?? textSize;
  const displayedFontFamily = selectedText?.fontFamily ?? fontFamily;
  const displayedFontColor = selectedText?.fontColor ?? fontColor;
  const displayedIsItalic = selectedText?.isItalic ?? isItalic;


  const handleDescriptionSelect = (value: string) => {
    if (textInputRef.current) {
      setTextInput(value);
      textInputRef.current.value = value;
      textInputRef.current.focus();
    }
  };

  const handleTextInsert = () => {
    if (!textInput.trim()) {
      alert("텍스트를 입력해주세요.");
      return;
    }
    
    // 항상 새 텍스트 삽입
    onTextInsert?.({
      text: textInput,
      fontSize: textSize,
      fontFamily,
      fontColor,
      isItalic,
    });
  };

  const handleTextSizeChange = (newSize: number) => {
    setTextSize(newSize);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { fontSize: newSize });
    }
  };

  const handleFontFamilyChange = (newFontFamily: string) => {
    setFontFamily(newFontFamily);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { fontFamily: newFontFamily });
    }
  };

  const handleFontColorChange = (newColor: string) => {
    setFontColor(newColor);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { fontColor: newColor });
    }
  };

  const handleItalicToggle = () => {
    const newIsItalic = !displayedIsItalic;
    setIsItalic(newIsItalic);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { isItalic: newIsItalic });
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--linear-space-2)' }}>
      {/* 첫 번째 카드: 텍스트 입력 및 추천 */}
      <aside className="linear-card">
        <h3>사진에 글씨 새기기</h3>
        <div className="linear-grid linear-mt-4" style={{ gridTemplateColumns: "1fr" }}>
          {/* 텍스트 입력 영역 */}
          <label>
            <p>텍스트를 입력하세요.</p>
            <textarea
              ref={textInputRef as React.RefObject<HTMLTextAreaElement>}
              className="linear-input linear-mt-2"
              style={{ 
                width: '90%', 
                borderColor: 'var(--linear-neutral-300)',
                minHeight: '100px',
                resize: 'vertical'
              }}
              placeholder="예) 너의 100일을 축하해 :)"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
          </label>
          
          <label className="linear-mt-2">
            <p>레터링을 추천해 드릴게요 :)</p>
            <select 
              className="linear-select linear-mt-2" 
              style={{ borderColor: 'var(--linear-neutral-300)' }}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleDescriptionSelect(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>클릭해서 추천받기</option>
              <option value="다비야, 너의 1000일을 축하해 :)">다비야, 너의 1000일을 축하해 :)</option>
              <option value="평생 함께 해♥">평생 함께 해♥</option>
              <option value="내 세상은 네가 있어 더 아름다워">내 세상은 네가 있어 더 아름다워</option>
              <option value="우리집 둘 째">우리집 둘 째</option>
              <option value="우리 곧, 결혼해요.">우리 곧, 결혼해요.</option>
              <option value="우리 셋의 세 번째 크리스마스">우리 셋의 세 번째 크리스마스</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
            </select>
          </label>
          
          <div className="linear-flex linear-mt-4">
            <button className="linear-button linear-button--secondary">삭제</button>
            <button className="linear-button linear-button--primary" onClick={handleTextInsert}>
              삽입
            </button>
          </div>
        </div>
      </aside>

      {/* 두 번째 카드: 텍스트 스타일 설정 */}
      <aside className="linear-card">
        <div className="linear-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--linear-space-2)" }}>
          {/* 상단 왼쪽: 글자 크기 */}
          <label>
            <p>글자 크기</p>
            <input 
              type="number"
              className="linear-input linear-input--number linear-mt-2"
              style={{ borderColor: 'var(--linear-neutral-300)', width: '60px' }}
              value={displayedTextSize}
              onChange={(e) => handleTextSizeChange(Number(e.target.value))}
              min="1"
              max="99"
              placeholder="16"
            />
          </label>
          
          {/* 상단 오른쪽: 폰트 */}
          <label>
            <p>폰트</p>
            <select 
              className="linear-select linear-mt-2"
              style={{ borderColor: 'var(--linear-neutral-300)' }}
              value={displayedFontFamily}
              onChange={(e) => handleFontFamilyChange(e.target.value)}
            >
              <option value="Inter">Inter</option>
              <option value="Noto Sans KR">Noto Sans KR</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
            </select>
          </label>
          
          {/* 하단 왼쪽: 폰트색상 */}
          <label>
            <p>폰트색상</p>
            <input 
              type="color"
              className="linear-input linear-mt-2"
              style={{ 
                borderColor: 'var(--linear-neutral-300)',
                width: '60px',
                height: '36px',
                padding: '2px'
              }}
              value={displayedFontColor}
              onChange={(e) => handleFontColorChange(e.target.value)}
            />
          </label>
          
          {/* 하단 오른쪽: 기울임 */}
          <label>
            <p>기울임</p>
            <button 
              className={`linear-button linear-mt-2 ${displayedIsItalic ? 'linear-button--primary' : 'linear-button--secondary'}`}
              style={{ width: '60px', fontSize: '14px' }}
              onClick={handleItalicToggle}
            >
              <em>/</em>
            </button>
          </label>
        </div>
      </aside>

      {/* 세 번째 카드: 내보내기 */}
      <aside className="linear-card">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="linear-button linear-button--primary" onClick={onExport}>내보내기</button>
        </div>
      </aside>
    </div>
  );
};
