import React, { useState } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2 } from 'lucide-react';

// Configure the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer({ url }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0); // Default scale

    // Auto-scale based on container width
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                // A standard A4 page is ~595px wide. We scale to fit the container.
                const containerWidth = containerRef.current.clientWidth;
                // Leave some padding
                const desiredWidth = containerWidth - 32;
                setScale(desiredWidth / 595);
            }
        };

        // Initial setup
        updateScale();

        // Update on resize
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    return (
        <div
            ref={containerRef}
            className="w-full bg-slate-100 rounded-xl overflow-y-auto overflow-x-hidden flex flex-col items-center py-4 border border-indigo-500/20 shadow-inner min-h-[400px]"
            style={{ maxHeight: '70vh' }}
        >
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                    <div className="flex flex-col items-center justify-center p-8 text-indigo-500 gap-2">
                        <Loader2 className="animate-spin" size={32} />
                        <span className="text-sm font-medium">Loading Invoice...</span>
                    </div>
                }
                error={
                    <div className="p-4 text-red-500 text-center text-sm font-medium bg-red-50 rounded-lg">
                        Failed to load PDF. Please tap the Download button below.
                    </div>
                }
            >
                {Array.from(new Array(numPages || 0), (el, index) => (
                    <div key={`page_${index + 1}`} className="mb-4 shadow-md bg-white">
                        <Page
                            pageNumber={index + 1}
                            scale={scale > 1.5 ? 1.5 : scale < 0.3 ? 0.3 : scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                        />
                    </div>
                ))}
            </Document>
        </div>
    );
}
