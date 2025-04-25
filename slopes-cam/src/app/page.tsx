'use client';

import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DefaultContent from './components/DefaultContent';
import Footer from './components/Footer';
import PWAInstall from './components/PWAInstall';
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration';
import InfoModal from './components/InfoModal';
import VideoPlayer from './components/VideoPlayer';
import { Resort } from './utils/links';

export default function Home() {
  const [activeSection, setActiveSection] = useState('default');
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResorts = async () => {
      try {
        const response = await fetch('/links.json');
        if (!response.ok) {
          throw new Error('Failed to fetch resorts data');
        }
        const data = await response.json();
        setResorts(data);
      } catch (error) {
        console.error('Error fetching resorts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResorts();
  }, []);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
  };

  if (loading) {
    return (
      <div className="loading">
        데이터를 불러오는 중입니다...
      </div>
    );
  }

  // Find the current active resort and webcam if applicable
  const getActiveContent = () => {
    if (activeSection === 'default') {
      return <DefaultContent isActive={true} />;
    }

    // Check if section includes a dash (resort-webcamIndex)
    if (activeSection.includes('-')) {
      const [resortId, webcamIdxStr] = activeSection.split('-');
      const webcamIdx = parseInt(webcamIdxStr, 10);
      const resort = resorts.find(r => r.id === resortId);

      if (resort && resort.links && resort.links[webcamIdx]) {
        const webcam = resort.links[webcamIdx];

        return (
          <div className={`content-section active`}>
            <h2>
              <span className="inline-title">{resort.name}</span>
              <span className="resort-label">{webcam.name}</span>
            </h2>
            <VideoPlayer
              webcam={webcam}
              resortId={resortId}
              webcamIndex={webcamIdx}
            />
            {webcam.link && (
              <div className="webcam-info">
                이 영상은 <a href={webcam.link} target="_blank" rel="noopener noreferrer">{resort.name} 공식 사이트</a>에서 제공하는 영상입니다.
              </div>
            )}
          </div>
        );
      }
    } else {
      // It's just a resort ID
      const resort = resorts.find(r => r.id === activeSection);

      if (resort) {
        // Check if the resort has webcams but they're not supposed to be displayed in the main page
        if (resort.hide_preview || !resort.links || resort.links.length === 0) {
          return (
            <div className={`content-section active`}>
              <h2>{resort.name}</h2>
              <p>이 리조트에서는 실시간 웹캠을 제공하지 않거나 제공 중단되었습니다.</p>
              {resort.status && (
                <p>
                  <a href={resort.status} target="_blank" rel="noopener noreferrer">
                    슬로프 상태 확인하기 <i className="bi bi-box-arrow-up-right"></i>
                  </a>
                </p>
              )}
            </div>
          );
        }

        // Display all webcams for this resort
        return (
          <div className={`content-section active`}>
            <h2>{resort.name}</h2>
            <div className="videos-grid">
              {resort.links.map((webcam, index) => (
                <div key={index} className="video-card">
                  <h3>{webcam.name}</h3>
                  <VideoPlayer
                    webcam={webcam}
                    resortId={resort.id}
                    webcamIndex={index}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }
    }

    // Fallback if nothing found
    return <DefaultContent isActive={true} />;
  };

  return (
    <div>
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        resorts={resorts}
      />

      <div className="main-content">
        {getActiveContent()}
      </div>

      <Footer />
      <PWAInstall />
      <ServiceWorkerRegistration />
      <InfoModal />
    </div>
  );
}
