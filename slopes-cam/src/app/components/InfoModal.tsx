'use client';

import { useState, useEffect } from 'react';

const InfoModal = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const infoButton = document.getElementById('infoButton');
    const closeInfoModal = document.getElementById('closeInfoModal');
    const infoModal = document.getElementById('info-modal');

    if (infoButton && closeInfoModal && infoModal) {
      const handleShowModal = () => {
        setIsVisible(true);
      };

      const handleCloseModal = () => {
        setIsVisible(false);
      };

      const handleClickOutside = (e: MouseEvent) => {
        if (e.target === infoModal) {
          setIsVisible(false);
        }
      };

      infoButton.addEventListener('click', handleShowModal);
      closeInfoModal.addEventListener('click', handleCloseModal);
      infoModal.addEventListener('click', handleClickOutside);

      return () => {
        infoButton.removeEventListener('click', handleShowModal);
        closeInfoModal.removeEventListener('click', handleCloseModal);
        infoModal.removeEventListener('click', handleClickOutside);
      };
    }
  }, []);

  return (
    <div id="info-modal" className="info-modal" style={{ display: isVisible ? 'flex' : 'none' }}>
      <div className="info-content">
        <button id="closeInfoModal" className="info-close">
          <i className="bi bi-x"></i>
        </button>
        <h2 className="info-title">Slopes cam - 전국 스키장 실시간 웹캠 모음</h2>
        <div className="info-text">
          <p>이 서비스에 대하여:</p>
          <ul>
            <li>이 서비스는 스키장에서 공식적으로 제공하는 서비스가 아닙니다. 관련하여 스키장에 문의하지 마세요.</li>
            <li>실시간 영상은 각 스키장에서 제공하는 콘텐츠를 임베드하여 보여주는 것으로, 서비스 제공자는 영상의 내용에 대해 책임지지 않습니다.</li>
            <li>모바일 기기에서도 홈 화면에 설치하여 웹앱처럼 이용할 수 있습니다.</li>
            <li>사이트 오류 제보, 문의 및 기능 제안은 <a href="https://github.com/hletrd/slopes/issues" target="_blank" rel="noopener noreferrer">Github Issues</a>로 해주세요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;