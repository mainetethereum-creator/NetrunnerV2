// Real loading progress for the loading screen (ADR-021). GLTFLoader, DRACOLoader and TextureLoader
// report to three.js' DefaultLoadingManager unless they are given another manager, so counting its
// items gives "files loaded out of files requested" without touching the scenes.
import { DefaultLoadingManager } from "three";

export interface LoadingProgress {
  url: string;
  loaded: number;
  total: number;
}

type Listener = (progress: LoadingProgress) => void;

const listeners = new Set<Listener>();
let installed = false;

function emit(url: string, loaded: number, total: number): void {
  for (const listener of listeners) listener({ url, loaded, total });
}

function install(): void {
  if (installed) return;
  installed = true;
  // Keep any handlers that were set before, only add ours.
  const previousStart = DefaultLoadingManager.onStart;
  const previousProgress = DefaultLoadingManager.onProgress;
  DefaultLoadingManager.onStart = (url, loaded, total) => {
    previousStart?.(url, loaded, total);
    emit(url, loaded, total);
  };
  DefaultLoadingManager.onProgress = (url, loaded, total) => {
    previousProgress?.(url, loaded, total);
    emit(url, loaded, total);
  };
}

/** Subscribes to file progress. Returns the unsubscribe function. */
export function watchLoadingProgress(listener: Listener): () => void {
  install();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
