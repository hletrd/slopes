'use client';

import { useState, useEffect } from 'react';
import { getResorts, Resort, VideoLink } from '../utils/links';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  resorts?: Resort[];
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange, resorts = [] }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const toggleSubmenu = (id: string) => {
    setActiveSubmenu(activeSubmenu === id ? null : id);
  };

  return (
    <>
      {isMobile && (
        <div className="mobile-nav">
          <div className="mobile-nav-inner">
            <button className="toggle-menu" onClick={toggleSidebar}>
              <i className="bi bi-list"></i>
            </button>
            <div className="mobile-title">
              <a href="./">Slopes cam</a>
            </div>
            <button id="infoButton" className="info-button">
              <i className="bi bi-info-circle"></i>
            </button>
          </div>
        </div>
      )}

      <div className={`sidebar-backdrop ${isOpen ? 'active' : ''}`} onClick={toggleSidebar}></div>

      <div className={`sidebar ${isOpen ? 'active' : ''}`}>
        <div className="site-title"><a href="./">Slopes cam</a></div>

        <div className="menu-item-container">
          <div
            className={`menu-item ${activeSection === 'default' ? 'active' : ''}`}
            onClick={() => {
              onSectionChange('default');
              if (isMobile) setIsOpen(false);
            }}
          >
            홈
          </div>
        </div>

        {resorts.map((resort) => (
          <div key={resort.id} className="menu-item-container">
            {resort.links && resort.links.length > 0 ? (
              <>
                <div
                  className={`menu-item ${activeSubmenu === resort.id ? 'active' : ''}`}
                  onClick={() => toggleSubmenu(resort.id)}
                >
                  {resort.name}
                  <button className="dropdown-toggle">
                    <i className={`bi ${activeSubmenu === resort.id ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                  </button>
                </div>
                <div className={`submenu ${activeSubmenu === resort.id ? 'active' : ''}`}>
                  {resort.links.map((link, index) => (
                    <div
                      key={`${resort.id}-${index}`}
                      className={`submenu-item ${activeSection === `${resort.id}-${index}` ? 'active' : ''}`}
                      onClick={() => {
                        onSectionChange(`${resort.id}-${index}`);
                        if (isMobile) setIsOpen(false);
                      }}
                    >
                      {link.name}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div
                className={`menu-item ${activeSection === resort.id ? 'active' : ''}`}
                onClick={() => {
                  onSectionChange(resort.id);
                  if (isMobile) setIsOpen(false);
                }}
              >
                {resort.name}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default Sidebar;