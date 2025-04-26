'use client';

import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';
import { VideoLink } from '../utils/links';

interface VideoPlayerProps {
  webcam: VideoLink;
  resortId: string;
  webcamIndex: number;
}

export const VideoPlayer = ({ webcam, resortId, webcamIndex }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  useEffect(() => {
    // Check if this webcam is already bookmarked
    try {
      const existingBookmarks = JSON.parse(localStorage.getItem('favorites') || '[]');
      const bookmarkExists = existingBookmarks.some(
        (bookmark: any) => bookmark.resortId === resortId && bookmark.webcamIndex === webcamIndex
      );
      setIsBookmarked(bookmarkExists);
    } catch (e) {
      console.error('Error checking bookmarks:', e);
    }

    if (!videoRef.current || webcam.video_type !== 'hls') return;

    // Clean up previous player instance
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    // Create new video element
    const videoElement = document.createElement('video');
    videoElement.className = 'video-js vjs-big-play-centered';
    videoElement.controls = true;
    videoElement.preload = 'auto';
    videoElement.setAttribute('playsinline', '');
    videoRef.current.innerHTML = '';
    videoRef.current.appendChild(videoElement);

    // Initialize video.js player
    const player = playerRef.current = videojs(videoElement, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      sources: [{
        src: webcam.video,
        type: webcam.video.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
      }],
      controlBar: {
        pictureInPictureToggle: false,
        fullscreenToggle: true,
        volumePanel: {
          inline: false
        }
      }
    });

    player.on('error', () => {
      const errorCode = player.error()?.code || 0;
      const errorMessage = getErrorMessage(errorCode);
      setError(errorMessage);
    });

    // Create custom control buttons
    const captureButton = document.createElement('button');
    captureButton.className = 'capture-button';
    captureButton.innerHTML = '<i class="bi bi-camera"></i> 캡쳐';
    captureButton.onclick = captureScreenshot;

    const pipButton = document.createElement('button');
    pipButton.className = 'pip-button';
    pipButton.innerHTML = '<i class="bi bi-pip"></i> PiP';
    pipButton.onclick = togglePictureInPicture;

    const bookmarkButton = document.createElement('button');
    bookmarkButton.className = isBookmarked
      ? 'bookmark-button active'
      : 'bookmark-button';
    bookmarkButton.innerHTML = isBookmarked
      ? '<i class="bi bi-bookmark-fill"></i> 북마크됨'
      : '<i class="bi bi-bookmark"></i> 북마크';
    bookmarkButton.onclick = toggleBookmark;

    // Add buttons to container if videoRef is available
    if (videoRef.current) {
      videoRef.current.appendChild(captureButton);
      videoRef.current.appendChild(pipButton);
      videoRef.current.appendChild(bookmarkButton);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [webcam, resortId, webcamIndex, isBookmarked]);

  const getErrorMessage = (code: number): string => {
    switch (code) {
      case 1:
        return "Fetching of the video failed.";
      case 2:
        return "The video playback was aborted.";
      case 3:
        return "The video could not be decoded.";
      case 4:
        return "The video format is not supported.";
      default:
        return "An unknown error occurred.";
    }
  };

  const captureScreenshot = () => {
    if (!playerRef.current) return;

    const canvas = document.createElement('canvas');
    const video = playerRef.current.el().querySelector('video');
    if (!video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `slopes-cam-${resortId}-${webcamIndex}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Screenshot capture failed:', e);
    }
  };

  const togglePictureInPicture = async () => {
    if (!playerRef.current) return;

    const video = playerRef.current.el().querySelector('video');
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.error('PiP failed:', e);
    }
  };

  const toggleBookmark = () => {
    const bookmarkData = {
      resortId,
      webcamIndex,
      name: webcam.name,
      timestamp: new Date().toISOString()
    };

    try {
      const existingBookmarks = JSON.parse(localStorage.getItem('favorites') || '[]');
      const bookmarkExists = existingBookmarks.some(
        (bookmark: any) => bookmark.resortId === resortId && bookmark.webcamIndex === webcamIndex
      );

      if (bookmarkExists) {
        const filteredBookmarks = existingBookmarks.filter(
          (bookmark: any) => !(bookmark.resortId === resortId && bookmark.webcamIndex === webcamIndex)
        );
        localStorage.setItem('favorites', JSON.stringify(filteredBookmarks));
        setIsBookmarked(false);

        // Update button state
        const bookmarkButton = videoRef.current?.querySelector('.bookmark-button');
        if (bookmarkButton) {
          bookmarkButton.classList.remove('active');
          (bookmarkButton as HTMLElement).innerHTML = '<i class="bi bi-bookmark"></i> 북마크';
        }
      } else {
        existingBookmarks.push(bookmarkData);
        localStorage.setItem('favorites', JSON.stringify(existingBookmarks));
        setIsBookmarked(true);

        // Update button state
        const bookmarkButton = videoRef.current?.querySelector('.bookmark-button');
        if (bookmarkButton) {
          bookmarkButton.classList.add('active');
          (bookmarkButton as HTMLElement).innerHTML = '<i class="bi bi-bookmark-fill"></i> 북마크됨';
        }
      }
    } catch (e) {
      console.error('Bookmark operation failed:', e);
    }
  };

  if (error) {
    return (
      <div className="placeholder-container">
        Error: {error}
      </div>
    );
  }

  // Render different player types based on video_type
  if (webcam.video_type === 'link') {
    return (
      <div className="video-container">
        <div className="link-container">
          <a href={webcam.video} target="_blank" rel="noopener noreferrer">
            <i className="bi bi-box-arrow-up-right"></i> {webcam.name}
          </a>
        </div>
        <button
          className={`bookmark-button bookmark-button-link ${isBookmarked ? 'active' : ''}`}
          onClick={toggleBookmark}
        >
          <i className={`bi bi-bookmark${isBookmarked ? '-fill' : ''}`}></i> {isBookmarked ? '북마크됨' : '북마크'}
        </button>
      </div>
    );
  } else if (webcam.video_type === 'vivaldi') {
    return (
      <div className="video-container">
        <div className="vivaldi-container">
          <iframe
            src={`/vivaldi.html?${webcam.video}`}
            title={webcam.name}
            width="100%"
            height="405"
            frameBorder="0"
            allowFullScreen
          ></iframe>
        </div>
        <button
          className={`bookmark-button bookmark-button-vivaldi ${isBookmarked ? 'active' : ''}`}
          onClick={toggleBookmark}
        >
          <i className={`bi bi-bookmark${isBookmarked ? '-fill' : ''}`}></i> {isBookmarked ? '북마크됨' : '북마크'}
        </button>
      </div>
    );
  } else if (webcam.video_type === 'youtube') {
    return (
      <div className="video-container">
        <div className="iframe-container">
          <iframe
            src={`https://www.youtube.com/embed/${webcam.video}?autoplay=1&mute=1`}
            title={webcam.name}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
        <button
          className={`bookmark-button bookmark-button-youtube ${isBookmarked ? 'active' : ''}`}
          onClick={toggleBookmark}
        >
          <i className={`bi bi-bookmark${isBookmarked ? '-fill' : ''}`}></i> {isBookmarked ? '북마크됨' : '북마크'}
        </button>
      </div>
    );
  } else {
    // Standard video player with videojs
    return (
      <div className="video-container">
        <div ref={videoRef} className="standard-video-container"></div>
      </div>
    );
  }
};

export default VideoPlayer;