export interface GraphControlsProps {
    groupByFolder: boolean;
    setGroupByFolder: (val: boolean) => void;
}

export function GraphControls({ groupByFolder, setGroupByFolder }: GraphControlsProps) {
    return (
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
            <label className="flex items-center gap-2 bg-black/80 backdrop-blur px-3 py-2 rounded border border-white/20 text-xs text-white cursor-pointer hover:bg-white/10 transition-colors">
                <input
                    type="checkbox"
                    checked={groupByFolder}
                    onChange={(e) => setGroupByFolder(e.target.checked)}
                    className="accent-[#FF9800]"
                />
                Group by Folders (Hive)
            </label>
        </div>
    );
}
