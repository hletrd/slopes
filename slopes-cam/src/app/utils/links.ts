import fs from 'fs';
import path from 'path';

export interface Coordinate {
  latitude: number;
  longitude: number;
  name: string;
}

export interface VideoLink {
  name: string;
  link?: string;
  video: string;
  video_type?: string;
}

export interface Resort {
  id: string;
  name: string;
  coordinates: Coordinate[];
  links?: VideoLink[];
  fetch?: boolean;
  status?: string;
  hide_preview?: boolean;
}

export function getResorts(): Resort[] {
  try {
    // Get the project root path
    const projectRoot = process.cwd();

    // Read and parse the links.json file
    const filePath = path.join(projectRoot, 'links.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data: Resort[] = JSON.parse(fileContent);

    return data;
  } catch (error) {
    console.error('Error loading links.json:', error);
    return [];
  }
}