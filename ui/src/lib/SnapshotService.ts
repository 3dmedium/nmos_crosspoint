export interface SnapshotConnection {
  srcDev: any;
  src: any;
  dstDev: any;
  dst: any;
}

export interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  connections: SnapshotConnection[];
}

const STORAGE_KEY = 'nmos_crosspoint_snapshots';

class _SnapshotService {
  saveSnapshot(name: string, connections: SnapshotConnection[]): Snapshot {
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      connections: structuredClone(connections)
    };

    const snapshots = this.getAllSnapshots();
    snapshots.push(snapshot);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));

    return snapshot;
  }

  getAllSnapshots(): Snapshot[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading snapshots:', e);
    }
    return [];
  }

  getSnapshot(id: string): Snapshot | null {
    const snapshots = this.getAllSnapshots();
    const filtered = snapshots.filter(s => s.id === id);
    return filtered.length > 0 ? filtered[0] : null;
  }

  deleteSnapshot(id: string): void {
    const snapshots = this.getAllSnapshots();
    const filtered = snapshots.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
}

const SnapshotService = new _SnapshotService();
export default SnapshotService;
