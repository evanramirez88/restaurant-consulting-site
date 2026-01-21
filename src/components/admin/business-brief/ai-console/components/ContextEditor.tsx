
import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, FileText, Image as ImageIcon, Cpu, BookOpen } from 'lucide-react';
import { CustomGPT, Folder, GeminiModel, FileAttachment, Libraries } from '../types';
import { fileToBase64, generateId } from '../utils/helpers';

interface Props {
    type: 'gpt' | 'project';
    initialData?: Partial<CustomGPT> | Partial<Folder>;
    libraries: Libraries;
    onSave: (data: any) => void;
    onClose: () => void;
}

export const ContextEditor: React.FC<Props> = ({ type, initialData, libraries, onSave, onClose }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [instructions, setInstructions] = useState((initialData as any)?.instructions || '');
    const [files, setFiles] = useState<FileAttachment[]>((initialData as any)?.files || []);

    // GPT
    const [model, setModel] = useState((initialData as CustomGPT)?.model || GeminiModel.FLASH);
    const [persona, setPersona] = useState((initialData as CustomGPT)?.persona || '');

    // Project
    const [plot, setPlot] = useState((initialData as Folder)?.plot || '');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        const common = { name, description, instructions, files };
        const data = type === 'gpt'
            ? { ...common, model, persona, id: initialData?.id || generateId(), createdAt: Date.now() }
            : { ...common, plot, id: initialData?.id || generateId(), createdAt: Date.now() };
        onSave(data);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: FileAttachment[] = [];
            const files = Array.from(e.target.files) as File[];
            for (const file of files) {
                try { newFiles.push({ id: generateId(), name: file.name, mimeType: file.type, data: await fileToBase64(file) }); } catch (e) { }
            }
            setFiles(p => [...p, ...newFiles]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-[#1e1e1e] w-full max-w-4xl rounded-xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] animate-fade-in text-gray-200">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-serif font-bold text-gray-200">{initialData?.id ? 'Edit' : 'Create'} {type === 'gpt' ? 'Assistant' : 'Project'}</h2>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-white" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 scrollbar-hide">
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#2d2d2d] border border-white/10 rounded-lg p-2 text-white focus:border-amber-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#2d2d2d] border border-white/10 rounded-lg p-2 text-white focus:border-amber-500 outline-none" />
                        </div>

                        {type === 'gpt' && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base Model</label>
                                <select value={model} onChange={e => setModel(e.target.value as GeminiModel)} className="w-full bg-[#2d2d2d] border border-white/10 rounded-lg p-2 text-white outline-none">
                                    <option value={GeminiModel.FLASH}>Gemini Flash (Fast)</option>
                                    <option value={GeminiModel.PRO}>Gemini Pro (Smart)</option>
                                </select>
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Files</label>
                                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-amber-500 hover:text-white flex items-center gap-1"><Upload size={10} /> Upload</button>
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                            </div>
                            <div className="space-y-2">
                                {files.map(f => (
                                    <div key={f.id} className="flex items-center justify-between bg-[#2d2d2d] p-2 rounded border border-white/5">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {f.mimeType.startsWith('image') ? <ImageIcon size={12} /> : <FileText size={12} />}
                                            <span className="text-xs truncate text-gray-300">{f.name}</span>
                                        </div>
                                        <button onClick={() => setFiles(files.filter(x => x.id !== f.id))}><Trash2 size={12} className="text-gray-500 hover:text-red-400" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {type === 'gpt' ? (
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase"><Cpu size={12} /> Persona</label>
                                    <select onChange={(e) => { if (e.target.value) setPersona(e.target.value); }} className="text-xs bg-[#2d2d2d] border border-white/10 rounded text-gray-400 outline-none">
                                        <option value="">Load Library...</option>
                                        {libraries.characters.map(c => <option key={c.id} value={c.content}>{c.name}</option>)}
                                    </select>
                                </div>
                                <textarea value={persona} onChange={e => setPersona(e.target.value)} className="w-full h-32 bg-[#2d2d2d] border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none" placeholder="Define personality..." />
                            </div>
                        ) : (
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase"><BookOpen size={12} /> Plot / Setting</label>
                                    <select onChange={(e) => { if (e.target.value) setPlot(e.target.value); }} className="text-xs bg-[#2d2d2d] border border-white/10 rounded text-gray-400 outline-none">
                                        <option value="">Load Library...</option>
                                        {libraries.plots.map(c => <option key={c.id} value={c.content}>{c.name}</option>)}
                                    </select>
                                </div>
                                <textarea value={plot} onChange={e => setPlot(e.target.value)} className="w-full h-32 bg-[#2d2d2d] border border-white/10 rounded-lg p-2 text-sm text-gray-200 outline-none" placeholder="Define business context..." />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">System Instructions</label>
                            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="w-full h-40 bg-[#2d2d2d] border border-white/10 rounded-lg p-2 text-sm font-mono text-gray-200 outline-none" placeholder="Strict rules..." />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-[#2d2d2d]">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium shadow-lg">Save</button>
                </div>
            </div>
        </div>
    );
};
