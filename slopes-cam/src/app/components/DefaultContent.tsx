'use client';

import { useState, useEffect } from 'react';
import { Resort } from '../utils/links';
import VideoPlayer from './VideoPlayer';
import DraggableBookmarks from './DraggableBookmarks';

interface DefaultContentProps {
  isActive: boolean;
}

interface Bookmark {
  resortId: string;
  webcamIndex: number;
  name: string;
  timestamp: string;
  resort?: string;
}

const DefaultContent: React.FC<DefaultContentProps> = ({ isActive }) => {
  const [hasFavorites, setHasFavorites] = useState(false);
  const [favorites, setFavorites] = useState<Bookmark[]>([]);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch resorts data
    const fetchResorts = async () => {
      try {
        const response = await fetch('/links.json');
        if (!response.ok) {
          throw new Error('Failed to fetch resorts data');
        }
        const data = await response.json();
        setResorts(data);

        // Now check for favorites
        const storedFavorites = localStorage.getItem('favorites');
        if (storedFavorites) {
          try {
            const parsedFavorites = JSON.parse(storedFavorites);

            // Enhance favorites with resort names
            const enhancedFavorites = parsedFavorites.map((fav: Bookmark) => {
              const resort = data.find((r: Resort) => r.id === fav.resortId);
              return {
                ...fav,
                resort: resort ? resort.name : 'Unknown Resort'
              };
            });

            setFavorites(enhancedFavorites);
            setHasFavorites(enhancedFavorites.length > 0);
          } catch (error) {
            console.error('Error parsing favorites:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching resorts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResorts();
  }, []);

  const removeFavorite = (resortId: string, webcamIndex: number) => {
    const updatedFavorites = favorites.filter(
      favorite => !(favorite.resortId === resortId && favorite.webcamIndex === webcamIndex)
    );

    setFavorites(updatedFavorites);
    setHasFavorites(updatedFavorites.length > 0);
    localStorage.setItem('favorites', JSON.stringify(updatedFavorites));
  };

  const getWebcamForBookmark = (bookmark: Bookmark) => {
    const resort = resorts.find(r => r.id === bookmark.resortId);
    if (resort && resort.links && resort.links[bookmark.webcamIndex]) {
      return resort.links[bookmark.webcamIndex];
    }
    return null;
  };

  const handleBookmarkReorder = (newOrder: number[]) => {
    const reorderedFavorites = newOrder.map(index => favorites[index]);
    setFavorites(reorderedFavorites);
    localStorage.setItem('favorites', JSON.stringify(reorderedFavorites));
  };

  return (
    <div id="default-message" className={`content-section content-section-default ${isActive ? 'active' : ''}`}>
      <div className="text-center p-4">
        <h2>전국 스키장 실시간 웹캠 모음</h2>
        <p className="lead" style={{ fontSize: '1.1rem' }}>왼쪽 메뉴에서 스키장 또는 카메라를 선택하세요.</p>
        <p className="disclaimer mt-2" style={{ fontSize: '0.8rem' }}>
          사이트 오류 제보, 문의 및 기능 제안 <span className="github-button-issue">
            <a className="github-button github-button-issue"
              href="https://github.com/hletrd/slopes/issues"
              data-color-scheme="no-preference: dark; light: dark; dark: dark;"
              data-icon="octicon-issue-opened"
              aria-label="Issue hletrd/slopes on GitHub">Issue</a>
          </span>
        </p>
        <p className="lead github-buttons">
          <a className="github-button"
            href="https://github.com/hletrd/slopes"
            data-color-scheme="no-preference: dark; light: dark; dark: dark;"
            data-icon="octicon-star"
            data-show-count="true"
            aria-label="Star hletrd/slopes on GitHub">Star</a>
          <a className="github-button"
            href="https://github.com/hletrd"
            data-color-scheme="no-preference: dark; light: dark; dark: dark;"
            data-show-count="true"
            aria-label="Follow @hletrd on GitHub">Follow @hletrd</a>
        </p>
        <p className="lead" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
          Special thanks to <a target="_blank" href="https://github.com/paulkim-xr" rel="noopener noreferrer">Paul Kim</a> and the <a target="_blank" href="https://paulkim-xr.github.io/SkiWatch/" rel="noopener noreferrer">SkiWatch</a> project.
        </p>
      </div>

      {loading ? (
        <div className="loading">북마크를 불러오는 중입니다...</div>
      ) : hasFavorites ? (
        <div id="favorites-container" className="favorites-section">
          <div className="favorites-header-container">
            <h3 className="bookmarks-title">북마크한 영상</h3>
            {favorites.length > 0 && (
              <button
                className="favorites-remove-button"
                onClick={() => {
                  localStorage.removeItem('favorites');
                  setFavorites([]);
                  setHasFavorites(false);
                }}
              >
                <i className="bi bi-trash"></i> 모두 삭제
              </button>
            )}
          </div>

          {favorites.length > 0 && (
            <div className="drag-instructions">
              <i className="bi bi-info-circle"></i> 북마크를 드래그하여 순서를 변경할 수 있습니다.
            </div>
          )}

          <div id="favorites-grid" className="favorites-grid">
            {favorites.map((favorite, index) => {
              const webcam = getWebcamForBookmark(favorite);
              if (!webcam) return null;

              return (
                <div key={`${favorite.resortId}-${favorite.webcamIndex}`} className="video-card favorite-card" data-index={index}>
                  <div className="favorite-header">
                    <i className="drag-handle bi bi-grip-vertical"></i>
                    <div className="dropdown-toggle">
                      <i className="bi bi-x" onClick={() => removeFavorite(favorite.resortId, favorite.webcamIndex)}></i>
                    </div>
                    <div className="favorite-location">{favorite.name}</div>
                    <div className="favorite-resort">{favorite.resort}</div>
                  </div>
                  <VideoPlayer
                    webcam={webcam}
                    resortId={favorite.resortId}
                    webcamIndex={favorite.webcamIndex}
                  />
                </div>
              );
            })}
          </div>

          {/* Add drag and drop functionality */}
          <DraggableBookmarks onReorder={handleBookmarkReorder} />
        </div>
      ) : null}
    </div>
  );
};

export default DefaultContent;