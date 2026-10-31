/**
 * Model Faceoff - Application Configuration
 *
 * This file contains all app-specific configuration that gets baked into the build.
 * It is committed to version control and shared across the team.
 *
 * For secrets (API keys, certificates), use environment variables or GitHub Secrets.
 */

export const config = {
  // ===========================================================================
  // APP IDENTITY
  // ===========================================================================

  /** App name shown in OS (menu bar, dock, task manager) */
  productName: 'Model Faceoff',

  /** Binary/executable name (lowercase, hyphens) */
  executableName: 'model-faceoff',

  /** macOS bundle identifier (reverse domain notation) */
  appBundleId: 'com.modelfaceoff.app',

  /** macOS app category */
  appCategory: 'public.app-category.developer-tools',

  // ===========================================================================
  // DATA STORAGE
  // ===========================================================================

  /** Folder name in user's app data directory (~/Library/Application Support on macOS) */
  appDataFolder: 'ModelFaceoff',

  /** SQLite database filename */
  dbFilename: 'app.db',

  // ===========================================================================
  // GITHUB (for releases & auto-updates)
  // ===========================================================================

  github: {
    /** GitHub username or organization */
    owner: 'dotnetfactory',

    /** Repository name */
    repo: 'model-faceoff',

    /**
     * Keep false. electron-updater reads releases anonymously from a public repo; a private repo
     * would need a token inside the app, which the build never embeds (see forge.config.ts). If
     * the source repo is private, publish to a public `<app>-releases` repo instead, as
     * storyflow-app and nitrosocial-app do with a RELEASES_TOKEN secret scoped to that repo.
     */
    private: false,
  },

  // ===========================================================================
  // FEATURES
  // ===========================================================================

  /** Enable auto-update checks on app startup */
  autoUpdateEnabled: true,

  // ===========================================================================
  // PACKAGE MAINTAINER (for Linux packages)
  // ===========================================================================

  maintainer: 'Emad Ibrahim <emad@emadibrahim.com>',
} as const;

/** Type for the config object */
export type AppConfig = typeof config;
