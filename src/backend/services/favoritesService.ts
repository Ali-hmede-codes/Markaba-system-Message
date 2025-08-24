import fs from 'fs/promises';
import path from 'path';

interface FavoriteGroup {
  id: string;
}

interface FavoritesData {
  groups: FavoriteGroup[];
}

class FavoritesService {
  private favoritesPath: string = path.join(__dirname, '../../../favorites.json');
  private favorites: FavoriteGroup[] = [];
  private lastLoaded: number = 0;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Load favorites from file with caching
   */
  private async loadFavorites(): Promise<void> {
    const now = Date.now();
    
    // Use cache if it's still valid
    if (this.favorites.length > 0 && (now - this.lastLoaded) < this.cacheTimeout) {
      return;
    }

    try {
      const data = await fs.readFile(this.favoritesPath, 'utf8');
      const favoritesData: FavoritesData = JSON.parse(data);
      this.favorites = favoritesData.groups || [];
      this.lastLoaded = now;
    } catch (error) {
      console.error('Error loading favorites:', error);
      this.favorites = [];
    }
  }

  /**
   * Get all favorite group IDs
   */
  async getFavoriteGroupIds(): Promise<string[]> {
    await this.loadFavorites();
    return this.favorites.map(group => group.id);
  }

  /**
   * Check if a group ID is in favorites
   */
  async isFavoriteGroup(groupId: string): Promise<boolean> {
    const favoriteIds = await this.getFavoriteGroupIds();
    return favoriteIds.includes(groupId);
  }

  /**
   * Filter group IDs to only include favorites
   */
  async filterFavoriteGroups(groupIds: string[]): Promise<string[]> {
    const favoriteIds = await this.getFavoriteGroupIds();
    return groupIds.filter(id => favoriteIds.includes(id));
  }

  /**
   * Validate that all provided group IDs are favorites
   */
  async validateAllFavorites(groupIds: string[]): Promise<{ valid: boolean; invalidIds: string[] }> {
    const favoriteIds = await this.getFavoriteGroupIds();
    const invalidIds = groupIds.filter(id => !favoriteIds.includes(id));
    
    return {
      valid: invalidIds.length === 0,
      invalidIds
    };
  }

  /**
   * Get favorites count
   */
  async getFavoritesCount(): Promise<number> {
    await this.loadFavorites();
    return this.favorites.length;
  }

  /**
   * Refresh favorites cache
   */
  async refreshCache(): Promise<void> {
    this.lastLoaded = 0;
    await this.loadFavorites();
  }
}

export default new FavoritesService();