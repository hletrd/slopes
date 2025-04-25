'use client';

import { useEffect, useRef } from 'react';
import { VideoLink } from '../utils/links';

interface VideoPlayerProps {
  webcam: VideoLink;
  resortId: string;
  webcamIndex: number;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ webcam, resortId, webcamIndex }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically import videojs to avoid SSR issues
    const loadVideoJS = async () => {
      const videojs = (await import('video.js')).default;

      // Import CSS
      await import('video.js/dist/video-js.css');

      if (!videoRef.current) return;

      // Clean up previous player instance
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }

      // Handle different video types
      let videoElement: HTMLVideoElement | null = null;

      if (webcam.video_type === 'link') {
        // For link type, we don't use videojs
        return;
      } else if (webcam.video_type === 'vivaldi') {
        // For vivaldi type, we don't use videojs
        return;
      } else if (webcam.video_type === 'youtube') {
        // For YouTube, we don't use videojs
        return;
      } else {
        // For HLS streams and other video types
        videoElement = document.createElement('video');
        videoElement.className = 'video-js vjs-big-play-centered';
        videoElement.controls = true;
        videoElement.preload = 'auto';
        videoElement.setAttribute('playsinline', '');

        // Clear container and append new video element
        if (videoRef.current) {
          videoRef.current.innerHTML = '';
          videoRef.current.appendChild(videoElement);
        }

        const options = {
          autoplay: false,
          preload: 'auto',
          controls: true,
          responsive: true,
          fluid: true,
          sources: [{
            src: webcam.video,
            type: webcam.video.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
          }]
        };

        // Initialize player
        playerRef.current = videojs(videoElement, options);

        // Create capture button
        const captureButton = document.createElement('button');
        captureButton.className = 'capture-button';
        captureButton.innerHTML = '<i class="bi bi-camera"></i> 캡쳐';
        captureButton.onclick = captureScreenshot;

        // Create PiP button
        const pipButton = document.createElement('button');
        pipButton.className = 'pip-button';
        pipButton.innerHTML = '<i class="bi bi-pip"></i> PiP';
        pipButton.onclick = togglePictureInPicture;

        // Create bookmark button
        const bookmarkButton = document.createElement('button');
        bookmarkButton.className = 'bookmark-button';
        bookmarkButton.innerHTML = '<i class="bi bi-bookmark"></i> 북마크';
        bookmarkButton.onclick = toggleBookmark;

        // Add buttons to container
        if (videoRef.current) {
          videoRef.current.appendChild(captureButton);
          videoRef.current.appendChild(pipButton);
          videoRef.current.appendChild(bookmarkButton);
        }
      }
    };

    loadVideoJS();

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [webcam]);

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

        // Update button state
        const bookmarkButton = videoRef.current?.querySelector('.bookmark-button');
        if (bookmarkButton) {
          bookmarkButton.classList.remove('active');
          (bookmarkButton as HTMLElement).innerHTML = '<i class="bi bi-bookmark"></i> 북마크';
        }
      } else {
        existingBookmarks.push(bookmarkData);
        localStorage.setItem('favorites', JSON.stringify(existingBookmarks));

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

  // Render different player types based on video_type
  if (webcam.video_type === 'link') {
    return (
      <div className="video-container">
        <div className="link-container">
          <a href={webcam.video} target="_blank" rel="noopener noreferrer">
            <i className="bi bi-box-arrow-up-right"></i> {webcam.name}
          </a>
        </div>
        <button className="bookmark-button bookmark-button-link" onClick={toggleBookmark}>
          <i className="bi bi-bookmark"></i> 북마크
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
        <button className="bookmark-button bookmark-button-vivaldi" onClick={toggleBookmark}>
          <i className="bi bi-bookmark"></i> 북마크
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
        <button className="bookmark-button bookmark-button-youtube" onClick={toggleBookmark}>
          <i className="bi bi-bookmark"></i> 북마크
        </button>
      </div>
    );
  } else {
    // Standard video player with videojs
    return (
      <div className="video-container">
        <div ref={videoRef} className="video-js"></div>
      </div>
    );
  }
};

export default VideoPlayer;