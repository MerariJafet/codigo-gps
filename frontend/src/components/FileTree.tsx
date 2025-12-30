import { useState } from 'react';
import { FileCode, Folder, FolderOpen, ChevronRight, ChevronDown, Box, Layers } from 'lucide-react';

const FileIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'py': return <FileCode size={14} className="text-blue-400" />;
        case 'js': return <FileCode size={14} className="text-yellow-400" />;
        case 'ts': return <FileCode size={14} className="text-blue-600" />;
        default: return <FileCode size={14} className="text-gray-400" />;
    }
};

const TreeNode = ({ node, onSelect }: any) => {
    const [isOpen, setIsOpen] = useState(false);

    const isFolder = node.children && node.children.length > 0;

    // Auto-expand if root or distinct folder

    return (
        <div className="pl-3 select-none">
            <div
                className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors duration-200 border border-transparent
                    ${isFolder ? 'hover:bg-white/5 hover:border-[#00F0FF]/20' : 'hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/40'}
                `}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isFolder) setIsOpen(!isOpen);
                    else onSelect(node.path); // path is the node ID usually
                }}
            >
                {isFolder && (
                    <span className="text-gray-500">
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                )}

                {isFolder ? (
                    isOpen ? <FolderOpen size={14} className="text-[#00F0FF]" /> : <Folder size={14} className="text-gray-500" />
                ) : (
                    <FileIcon type={node.name.split('.').pop() || ''} />
                )}

                <span className={`text-xs font-mono truncate ${isFolder ? 'text-gray-300 font-bold' : 'text-gray-400'}`}>
                    {node.name}
                </span>
            </div>

            {isFolder && isOpen && (
                <div className="border-l border-gray-800 ml-2">
                    {node.children.map((child: any) => (
                        <TreeNode key={child.path} node={child} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function FileTree({ files, onSelect }: any) {
    // Transform flat list of paths/nodes to Tree structure
    const buildTree = (fileList: any[]) => {
        const root: any = { name: 'root', children: [], path: '' };

        fileList.forEach(file => {
            const parts = file.label.split('/'); // Assuming label is rel path
            let current = root;

            parts.forEach((part: string, idx: number) => {
                let existing = current.children.find((c: any) => c.name === part);
                if (!existing) {
                    const isFile = idx === parts.length - 1;
                    const newNode = {
                        name: part,
                        path: file.id, // Use ID for selection
                        children: [],
                        type: isFile ? 'file' : 'folder'
                    };
                    current.children.push(newNode);
                    existing = newNode;
                }
                current = existing;
            });
        });

        return root.children;
    };

    const treeData = buildTree(files);

    return (
        <div className="w-full">
            {treeData.map((node: any) => (
                <TreeNode key={node.name} node={node} onSelect={onSelect} />
            ))}
        </div>
    );
}
