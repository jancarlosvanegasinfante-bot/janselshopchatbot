import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getProxiedImageUrl(url?: string): string {
  if (!url) return "";
  if (
    url.startsWith("/") || 
    url.startsWith("data:") || 
    url.includes("unsplash.com") || 
    url.includes("firebasestorage.googleapis.com") ||
    url.includes("mlstatic.com") ||
    url.includes("ibb.co")
  ) {
    return url;
  }
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

