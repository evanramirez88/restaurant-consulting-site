
import { useRef, useEffect } from 'react';
import { Thread, Folder, CustomGPT } from '../types';


export function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data:image/xxx;base64, prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

export function downloadThreadAsMarkdown(thread: Thread) {
    const content = thread.messages.map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `### ${role} (${new Date(msg.timestamp).toLocaleString()})\n\n${msg.text}\n`;
    }).join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thread.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function useClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler();
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}

export function exportProjectToZip(project: Folder, threads: Thread[], gpts: CustomGPT[]) {
    // Stub for now - simulating export
    console.log("Exporting project:", project.name);
    alert(`Exported project "${project.name}" (Stub)`);
}
