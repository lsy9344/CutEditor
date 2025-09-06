import React from "react";

export const WizardFooter: React.FC = () => {
  return (
    <footer className="linear-footer">
      <div className="linear-container linear-flex" style={{ justifyContent: "flex-end" }}>
        <button className="linear-button linear-button--secondary">이전</button>
        <button className="linear-button linear-button--secondary">다음</button>
        <button className="linear-button linear-button--primary">내보내기</button>
      </div>
    </footer>
  );
};
