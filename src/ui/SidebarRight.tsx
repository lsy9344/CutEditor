import React, { useState, useRef } from "react";

export const SidebarRight: React.FC = () => {
  const [textInput, setTextInput] = useState("");
  const [textSize, setTextSize] = useState(16);
  const textInputRef = useRef<HTMLInputElement>(null);

  const handleDescriptionSelect = (value: string) => {
    if (textInputRef.current) {
      setTextInput(value);
      textInputRef.current.value = value;
      textInputRef.current.focus();
    }
  };

  return (
    <aside className="linear-card">
      <h3>사진에 글씨 새기기</h3>
      <div className="linear-grid linear-mt-4" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <div className="linear-flex" style={{ alignItems: "end", gap: "var(--linear-space-3)" }}>
            <label style={{ flex: 1 }}>
              <h4>텍스트를 입력하세요.</h4>
              <input 
                ref={textInputRef}
                className="linear-input linear-mt-4" 
                style={{ width: '210px' }}
                placeholder="예) 너의 100일을 축하해 :)" 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
            </label>
            <label>
              <h4>글자 크기</h4>
              <input 
                type="number"
                className="linear-input linear-input--number linear-mt-4"
                value={textSize}
                onChange={(e) => setTextSize(Number(e.target.value))}
                min="1"
                max="99"
                placeholder="16"
              />
            </label>
          </div>
        </div>
        <label>
          <h4>레터링을 추천해 드릴게요 :)</h4>
          <select 
            className="linear-select linear-mt-4" 
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
          <button className="linear-button linear-button--primary">삽입</button>
        </div>
      </div>
    </aside>
  );
};
