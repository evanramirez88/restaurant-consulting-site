
import React, { useState, useRef } from 'react';
import {
    Plus, Folder as FolderIcon, Settings as SettingsIcon,
    ChevronDown, ChevronRight, MoreHorizontal, Bot, Sparkles, Pencil, FileDown, Trash2
} from 'lucide-react';
import { Folder, Thread, CustomGPT } from '../types';
import { useClickOutside, exportProjectToZip } from '../utils/helpers';

interface SidebarProps {
    folders: Folder[];
    threads: Thread[];
    customGpts: CustomGPT[];
    activeThreadId: string | null;
    onSelectThread: (id: string) => void;
    onCreateThread: (gptId?: string, folderId?: string) => void;
    onCreateFolder: () => void;
    onEditFolder: (folder: Folder) => void;
    onCreateGpt: () => void;
    onEditGpt: (gpt: CustomGPT) => void;
    onDeleteGpt: (id: string) => void;
    onMoveGpt: (gptId: string, folderId: string | null) => void;
    onDeleteThread: (id: string) => void;
    onMoveThread: (threadId: string, folderId: string | null) => void;
    onOpenSettings: () => void;
}

// --- Popover Menu Component ---
const PopoverMenu = ({
    isOpen,
    onClose,
    position,
    children
}: {
    isOpen: boolean;
    onClose: () => void;
    position: { x: number, y: number };
    children?: React.ReactNode
}) => {
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, onClose);

    if (!isOpen) return null;

    const style: React.CSSProperties = {
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 9999,
    };

    return (
        <div ref={ref} style={style} className="w-48 bg-[#252525] border border-gray-700 rounded-lg shadow-2xl py-1 animate-fade-in">
            {children}
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({
    folders, threads, customGpts, activeThreadId,
    onSelectThread, onCreateThread, onCreateFolder, onEditFolder,
    onCreateGpt, onEditGpt, onDeleteGpt, onMoveGpt,
    onDeleteThread, onMoveThread, onOpenSettings
}) => {
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
    const [menuState, setMenuState] = useState<{
        isOpen: boolean;
        type: 'thread' | 'gpt' | 'folder';
        id: string;
        pos: { x: number, y: number };
        data?: any;
    }>({ isOpen: false, type: 'thread', id: '', pos: { x: 0, y: 0 } });

    const handleMenuClick = (e: React.MouseEvent, type: 'thread' | 'gpt' | 'folder', id: string, data?: any) => {
        e.stopPropagation();
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setMenuState({
            isOpen: true,
            type,
            id,
            pos: { x: rect.right + 10, y: rect.top },
            data
        });
    };

    const closeMenu = () => setMenuState(prev => ({ ...prev, isOpen: false }));

    const toggleFolder = (folderId: string) => {
        const next = new Set(collapsedFolders);
        next.has(folderId) ? next.delete(folderId) : next.add(folderId);
        setCollapsedFolders(next);
    };

    const unorganizedThreads = threads.filter(t => !t.folderId);
    const unorganizedGpts = customGpts.filter(g => !g.folderId);

    return (
        <>
            <div className="flex flex-col h-full bg-[#1e1e1e] border-r border-[#333] select-none text-gray-300">

                {/* Header / Branding */}
                <div className="p-5 pb-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500 font-serif font-bold text-sm tracking-widest">MI</div>
                        <div className="flex flex-col">
                            <span className="font-serif font-semibold text-base text-gray-100 tracking-wide leading-tight">Millstone</span>
                            <span className="font-sans text-[10px] text-amber-500 uppercase tracking-[0.15em]">Intelligence</span>
                        </div>
                    </div>

                    <button
                        onClick={() => onCreateThread()}
                        className="w-full flex items-center justify-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 border border-white/5 rounded-md py-2 text-sm font-medium transition-all group shadow-sm"
                    >
                        <Plus size={16} className="text-amber-500 group-hover:rotate-90 transition-transform" /> New Intelligence
                    </button>
                </div>

                {/* Scroll Content */}
                <div className="flex-1 overflow-y-auto px-3 space-y-6 scrollbar-hide">

                    {/* Projects */}
                    <div>
                        <div className="flex items-center justify-between px-2 py-1 group mb-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Projects</span>
                            <button onClick={onCreateFolder} className="text-gray-500 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={14} /></button>
                        </div>
                        <div className="space-y-0.5">
                            {folders.map(f => {
                                const isCollapsed = collapsedFolders.has(f.id);
                                const fThreads = threads.filter(t => t.folderId === f.id);
                                const fGpts = customGpts.filter(g => g.folderId === f.id);

                                return (
                                    <div key={f.id}>
                                        <div className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#2d2d2d] cursor-pointer text-gray-400 hover:text-gray-200 transition-colors" onClick={() => toggleFolder(f.id)}>
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {isCollapsed ? <ChevronRight size={12} className="opacity-50" /> : <ChevronDown size={12} className="opacity-50" />}
                                                <FolderIcon size={14} className="text-amber-500/60" />
                                                <span className="text-sm truncate font-medium">{f.name}</span>
                                            </div>
                                            <button onClick={(e) => handleMenuClick(e, 'folder', f.id, f)} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 text-gray-400"><MoreHorizontal size={14} /></button>
                                        </div>

                                        {!isCollapsed && (
                                            <div className="ml-3 pl-3 border-l border-white/5 space-y-0.5 mt-1">
                                                {fGpts.map(g => (
                                                    <div key={g.id} className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#2d2d2d] cursor-pointer text-gray-400 hover:text-gray-200" onClick={() => onCreateThread(g.id, f.id)}>
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <Sparkles size={12} className="text-purple-400" />
                                                            <span className="text-sm truncate">{g.name}</span>
                                                        </div>
                                                        <button onClick={(e) => handleMenuClick(e, 'gpt', g.id, g)} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5"><MoreHorizontal size={14} /></button>
                                                    </div>
                                                ))}
                                                {fThreads.map(t => (
                                                    <div key={t.id} className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer ${activeThreadId === t.id ? 'bg-[#2d2d2d] text-amber-500 font-medium' : 'text-gray-400 hover:bg-[#2d2d2d] hover:text-gray-200'}`} onClick={() => onSelectThread(t.id)}>
                                                        <span className="text-sm truncate">{t.title || 'New Chat'}</span>
                                                        <button onClick={(e) => handleMenuClick(e, 'thread', t.id, t)} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5"><MoreHorizontal size={14} /></button>
                                                    </div>
                                                ))}
                                                {fThreads.length === 0 && fGpts.length === 0 && <div className="px-2 py-1 text-xs italic text-gray-600">Empty Project</div>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Assistants */}
                    {unorganizedGpts.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between px-2 py-1 group mb-1">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Agents</span>
                                <button onClick={onCreateGpt} className="text-gray-500 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={14} /></button>
                            </div>
                            {unorganizedGpts.map(g => (
                                <div key={g.id} className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#2d2d2d] cursor-pointer text-gray-400 hover:text-gray-200" onClick={() => onCreateThread(g.id)}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Bot size={14} className="text-amber-500/80" />
                                        <span className="text-sm truncate">{g.name}</span>
                                    </div>
                                    <button onClick={(e) => handleMenuClick(e, 'gpt', g.id, g)} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5"><MoreHorizontal size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recent Chats */}
                    <div>
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">History</div>
                        {unorganizedThreads.map(t => (
                            <div key={t.id} className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer ${activeThreadId === t.id ? 'bg-[#2d2d2d] text-amber-500 font-medium' : 'text-gray-400 hover:bg-[#2d2d2d] hover:text-gray-200'}`} onClick={() => onSelectThread(t.id)}>
                                <span className="text-sm truncate">{t.title || 'New Chat'}</span>
                                <button onClick={(e) => handleMenuClick(e, 'thread', t.id, t)} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5"><MoreHorizontal size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/5 space-y-1">
                    <button onClick={onCreateGpt} className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#2d2d2d] text-gray-400 hover:text-gray-200 transition-colors text-sm">
                        <Sparkles size={16} /> Create Agent
                    </button>
                    <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#2d2d2d] text-gray-400 hover:text-gray-200 transition-colors text-sm">
                        <SettingsIcon size={16} /> System
                    </button>
                </div>

            </div>

            {/* Fixed Popover Menu */}
            <PopoverMenu isOpen={menuState.isOpen} onClose={closeMenu} position={menuState.pos}>
                {menuState.type === 'folder' && (
                    <>
                        <div onClick={() => { onEditFolder(menuState.data); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-gray-300"><Pencil size={14} /> Edit Project</div>
                        <div onClick={() => { exportProjectToZip(menuState.data, threads.filter(t => t.folderId === menuState.id), customGpts.filter(g => g.folderId === menuState.id)); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-gray-300"><FileDown size={14} /> Export ZIP</div>
                    </>
                )}
                {menuState.type === 'gpt' && (
                    <>
                        <div onClick={() => { onEditGpt(menuState.data); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-gray-300"><Pencil size={14} /> Edit Agent</div>
                        <div className="border-t border-white/10 my-1"></div>
                        <div className="px-3 py-1 text-xs text-gray-500 font-bold uppercase">Move To...</div>
                        {folders.map(f => (
                            <div key={f.id} onClick={() => { onMoveGpt(menuState.id, f.id); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm text-gray-300 truncate">{f.name}</div>
                        ))}
                        <div onClick={() => { onMoveGpt(menuState.id, null); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm text-gray-400 italic">No Folder</div>
                        <div className="border-t border-white/10 my-1"></div>
                        <div onClick={() => { onDeleteGpt(menuState.id); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-red-400"><Trash2 size={14} /> Delete</div>
                    </>
                )}
                {menuState.type === 'thread' && (
                    <>
                        <div onClick={() => { onDeleteThread(menuState.id); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-red-400"><Trash2 size={14} /> Delete Chat</div>
                        <div className="border-t border-white/10 my-1"></div>
                        <div className="px-3 py-1 text-xs text-gray-500 font-bold uppercase">Move To...</div>
                        {folders.map(f => (
                            <div key={f.id} onClick={() => { onMoveThread(menuState.id, f.id); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm text-gray-300 truncate">{f.name}</div>
                        ))}
                        <div onClick={() => { onMoveThread(menuState.id, null); closeMenu(); }} className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm text-gray-400 italic">No Folder</div>
                    </>
                )}
            </PopoverMenu>
        </>
    );
};
