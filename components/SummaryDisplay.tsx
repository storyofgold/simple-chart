

import React, { useState } from 'react';
import { SummaryData, GroundingChunk } from '../types';

interface SummaryDisplayProps {
    summary: SummaryData | null;
    sources: GroundingChunk[] | null;
    isLoading: boolean;
    error: string | null;
    onAnalyzeImage: (file: File) => Promise<void>;
    isAnalyzingImage: boolean;
}

const LoadingSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-800 p-6 rounded-lg shadow-md">
                <div className="h-6 bg-slate-700 rounded w-1/4 mb-4"></div>
                <div className="space-y-2">
                    <div className="h-4 bg-slate-700 rounded w-full"></div>
                    <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                </div>
            </div>
        ))}
    </div>
);

const SummaryCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="summary-card bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700 transform hover:scale-[1.02] transition-transform duration-300">
        <div className="flex items-center mb-4">
            <span className="text-cyan-400 mr-3 print-preserve-color">{icon}</span>
            <h3 className="text-xl font-bold text-slate-100">{title}</h3>
        </div>
        <div className="text-slate-300 space-y-3 prose prose-invert prose-sm max-w-none">
            {children}
        </div>
    </div>
);

const ImageAnalysisUploader: React.FC<{ onAnalyze: (file: File) => void; isLoading: boolean; }> = ({ onAnalyze, isLoading }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setSelectedFile(null);
            setPreview(null);
        }
    };

    const handleAnalyzeClick = () => {
        if (selectedFile) {
            onAnalyze(selectedFile);
        }
    };

    return (
        <div className="mt-4 border-t border-slate-700 pt-4">
            <h4 className="font-semibold text-slate-200 mb-2">Analyze Your Chart Screenshot</h4>
            <p className="text-sm text-slate-400 mb-3">Upload a screenshot of your chart to get an updated analysis based on Wyckoff Methodology.</p>
            <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    <span>{selectedFile ? 'Change File' : 'Select File'}</span>
                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} disabled={isLoading}/>
                </label>
                <button
                    onClick={handleAnalyzeClick}
                    disabled={!selectedFile || isLoading}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed flex items-center"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                        </>
                    ) : 'Analyze Screenshot'}
                </button>
            </div>
            {preview && <p className="text-sm text-slate-400 mt-2 truncate">Selected: {selectedFile?.name}</p>}
            {preview && (
                 <div className="mt-4 border border-slate-600 rounded-md p-2 bg-slate-900/50">
                    <img src={preview} alt="Chart preview" className="max-h-40 rounded-md mx-auto" />
                </div>
            )}
        </div>
    );
};


const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ summary, sources, isLoading, error, onAnalyzeImage, isAnalyzingImage }) => {
    if (isLoading) {
        return <LoadingSkeleton />;
    }

    if (error) {
        return (
            <div className="bg-red-900 border border-red-700 text-red-200 p-6 rounded-lg text-center">
                <h3 className="text-xl font-bold mb-2">Analysis Failed</h3>
                <p>{error}</p>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="bg-slate-800 border border-slate-700 text-slate-400 p-6 rounded-lg text-center">
                <h3 className="text-xl font-bold">No Analysis Available</h3>
                <p>Please select a currency pair to generate an analysis.</p>
            </div>
        );
    }
    
    const biasColor = summary.technicalAnalysis.bias === 'Bullish' ? 'text-green-400' : summary.technicalAnalysis.bias === 'Bearish' ? 'text-red-400' : 'text-yellow-400';
    const biasIcon = summary.technicalAnalysis.bias === 'Bullish' ? '▲' : summary.technicalAnalysis.bias === 'Bearish' ? '▼' : '▬';


    return (
        <div className="summary-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SummaryCard title="Fundamental News" icon={<NewspaperIcon />}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{summary.fundamentalNews}</div>
            </SummaryCard>
            <SummaryCard title="Technical Analysis (30M)" icon={<ChartBarIcon />}>
                <div className="flex items-center text-lg font-semibold">
                    Bias: <span className={`ml-2 ${biasColor} print-preserve-color`}>{biasIcon} {summary.technicalAnalysis.bias}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{summary.technicalAnalysis.reasoning}</div>
                <div className="print-hidden">
                    <ImageAnalysisUploader onAnalyze={onAnalyzeImage} isLoading={isAnalyzingImage} />
                </div>
            </SummaryCard>
            <SummaryCard title="Daily Timeline & Outlook" icon={<CalendarDaysIcon />}>
                <h4 className="font-semibold text-slate-200">Recap</h4>
                <div style={{ whiteSpace: 'pre-wrap' }}>{summary.dailyAnalysis.recap}</div>
                <h4 className="font-semibold text-slate-200 mt-4">Today's Outlook</h4>
                <div style={{ whiteSpace: 'pre-wrap' }}>{summary.dailyAnalysis.todayOutlook}</div>
            </SummaryCard>
            <div className="lg:col-span-2">
                <SummaryCard title="Correlated Summary & Conclusion" icon={<SparklesIcon />}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{summary.correlatedSummary}</div>
                </SummaryCard>
            </div>
            <div className="lg:col-span-2">
                 <SummaryCard title="Upcoming Events" icon={<CalendarIcon />}>
                    <ul className="space-y-3">
                        {summary.upcomingEvents.length > 0 ? summary.upcomingEvents.map((event, index) => (
                            <li key={index} className="flex flex-col sm:flex-row justify-between p-2 bg-slate-700/50 rounded-md">
                                <span className="font-semibold">{event.event}</span>
                                <span className="text-slate-400 text-xs sm:text-sm">{event.date} at {event.time}</span>
                            </li>
                        )) : <p>No major events scheduled for this week.</p>}
                    </ul>
                </SummaryCard>
            </div>
        </div>
    );
};

// SVG Icons
const NewspaperIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6M7 8h6" /></svg>;
const ChartBarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L10 17l-4 4 4-4 6.293-6.293a1 1 0 011.414 0L21 11.293" /></svg>;
const CalendarDaysIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0h18M-4.5 12h22.5" /></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>;


export default SummaryDisplay;