

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import SummaryDisplay from './components/SummaryDisplay';
import { generateMarketSummary, generateImageBasedAnalysis } from './services/geminiService';
import { SummaryData, TradingPair, GroundingChunk } from './types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const TRADING_PAIRS: TradingPair[] = [
    { name: "Gold (XAU/USD)", symbol: "OANDA:XAUUSD" },
    { name: "S&P 500", symbol: "OANDA:SPX500USD" },
    { name: "EUR/USD", symbol: "OANDA:EURUSD" },
    { name: "USD/JPY", symbol: "OANDA:USDJPY" },
];

const App: React.FC = () => {
    const [selectedPair, setSelectedPair] = useState<TradingPair>(TRADING_PAIRS[0]);
    const [analysisCache, setAnalysisCache] = useState<Record<string, { summary: SummaryData; sources: GroundingChunk[] }>>({});
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [errorStates, setErrorStates] = useState<Record<string, string | null>>({});
    const [uploadedImageCache, setUploadedImageCache] = useState<Record<string, string | null>>({});
    const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false);
    const [chartLayouts, setChartLayouts] = useState<Record<string, object>>({});
    const [isPdfSaving, setIsPdfSaving] = useState<boolean>(false);

    const formattedDate = useMemo(() => {
        const today = new Date();
        const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(today);
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = String(today.getFullYear()).slice(-2); // Get last two digits
        return `${dayName} ${day}-${month}-${year}`;
    }, []);
    
    const fetchAnalysis = useCallback(async (pair: TradingPair) => {
        setLoadingStates(prev => ({ ...prev, [pair.symbol]: true }));
        setErrorStates(prev => ({ ...prev, [pair.symbol]: null }));
        // Clear old image when fetching new analysis
        setUploadedImageCache(prev => ({ ...prev, [pair.symbol]: null }));
        
        try {
            const { summary: newSummary, sources: newSources } = await generateMarketSummary(pair.name);
            setAnalysisCache(prev => ({
                ...prev,
                [pair.symbol]: { summary: newSummary, sources: newSources },
            }));
        } catch (e: any) {
            setErrorStates(prev => ({ ...prev, [pair.symbol]: e.message || "An unknown error occurred." }));
        } finally {
            setLoadingStates(prev => ({ ...prev, [pair.symbol]: false }));
        }
    }, []);

    useEffect(() => {
        if (!analysisCache[selectedPair.symbol]) {
            fetchAnalysis(selectedPair);
        }
    }, [selectedPair, analysisCache, fetchAnalysis]);

    const handleRefresh = useCallback(() => {
        fetchAnalysis(selectedPair);
    }, [selectedPair, fetchAnalysis]);

     const handleAnalyzeImage = async (file: File) => {
        const currentSummary = analysisCache[selectedPair.symbol]?.summary;
        if (!currentSummary) {
            setErrorStates(prev => ({ ...prev, [selectedPair.symbol]: "Please wait for the initial analysis to load before analyzing an image." }));
            return;
        }
        setIsAnalyzingImage(true);
        setErrorStates(prev => ({ ...prev, [selectedPair.symbol]: null }));

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            try {
                const base64DataUrl = reader.result as string;
                if (!base64DataUrl) {
                    throw new Error("Could not read file as a data URL.");
                }
                setUploadedImageCache(prev => ({ ...prev, [selectedPair.symbol]: base64DataUrl }));
                const base64String = base64DataUrl.split(',')[1];
                if (!base64String) {
                    throw new Error("Could not extract base64 data from the data URL.");
                }
                const imageData = { data: base64String, mimeType: file.type };
                const { technicalAnalysis, correlatedSummary } = await generateImageBasedAnalysis(imageData, selectedPair.name, currentSummary);
                setAnalysisCache(prevCache => {
                    const currentPairData = prevCache[selectedPair.symbol];
                    if (!currentPairData) return prevCache;
                    return { ...prevCache, [selectedPair.symbol]: { ...currentPairData, summary: { ...currentPairData.summary, technicalAnalysis, correlatedSummary } } };
                });
            } catch (e: any)
 {
                setErrorStates(prev => ({ ...prev, [selectedPair.symbol]: e.message || "Failed to analyze the uploaded image." }));
                // Clear the image on failure
                 setUploadedImageCache(prev => ({ ...prev, [selectedPair.symbol]: null }));
            } finally {
                setIsAnalyzingImage(false);
            }
        };
        reader.onerror = () => {
            setIsAnalyzingImage(false);
            setErrorStates(prev => ({ ...prev, [selectedPair.symbol]: "An error occurred while reading the image file." }));
        };
    };
    
    const handlePrintToPdf = async () => {
        setIsPdfSaving(true);
        const mainContent = document.querySelector('main');
        if (!mainContent) {
            console.error("Main content area not found for PDF generation.");
            setIsPdfSaving(false);
            return;
        }
    
        document.body.classList.add('printing-pdf');
        await new Promise(resolve => setTimeout(resolve, 50));
    
        try {
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const pageMargin = 20;
    
            // Set the background color for the first page
            pdf.setFillColor('#0f172a'); // slate-900
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
    
            const elementsToPrint = mainContent.querySelectorAll('.printable-section, .summary-card');
            let yPos = pageMargin;
    
            for (const element of Array.from(elementsToPrint)) {
                const images = element.querySelectorAll('img');
                const imagePromises = Array.from(images).map(img => {
                    if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
                    return new Promise<void>(resolve => {
                        img.onload = () => resolve();
                        img.onerror = () => resolve();
                    });
                });
                await Promise.all(imagePromises);
    
                const canvas = await html2canvas(element as HTMLElement, {
                    scale: 2,
                    backgroundColor: '#0f172a',
                    useCORS: true,
                    logging: false,
                });
                
                const imgData = canvas.toDataURL('image/png');
                const canvasAspectRatio = canvas.width / canvas.height;
                const imgHeight = pdfWidth / canvasAspectRatio;
    
                if (yPos > pageMargin && yPos + imgHeight > pdfHeight - pageMargin) {
                    pdf.addPage();
                    // Set the background color for the new page
                    pdf.setFillColor('#0f172a'); // slate-900
                    pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
                    yPos = pageMargin;
                }
    
                pdf.addImage(imgData, 'PNG', 0, yPos, pdfWidth, imgHeight);
                yPos += imgHeight + 10; // Add a smaller 10pt gap
            }
            
            const safePairName = selectedPair.name.replace(/[\/\s]/g, '_');
            pdf.save(`market-analysis-${safePairName}-${new Date().toISOString().split('T')[0]}.pdf`);
    
        } catch (error) {
            console.error("Failed to save PDF:", error);
        } finally {
            document.body.classList.remove('printing-pdf');
            setIsPdfSaving(false);
            // Revert to showing the TradingView widget after saving the PDF
            setUploadedImageCache(prev => ({ ...prev, [selectedPair.symbol]: null }));
        }
    };

    const handleDirectPrint = async () => {
        const mainContent = document.querySelector('main');
        if (!mainContent) return;
        
        const images = mainContent.querySelectorAll('img');
        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
            });
        });
        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, 100));

        document.body.classList.add('printing-light');
        
        const handleAfterPrint = () => {
            document.body.classList.remove('printing-light');
            // Revert to showing the TradingView widget after printing
            setUploadedImageCache(prev => ({ ...prev, [selectedPair.symbol]: null }));
            window.removeEventListener('afterprint', handleAfterPrint);
        };
        window.addEventListener('afterprint', handleAfterPrint);

        window.print();

        setTimeout(() => {
             if (document.body.classList.contains('printing-light')) {
                document.body.classList.remove('printing-light');
                // Revert to showing the TradingView widget (fallback)
                setUploadedImageCache(prev => ({ ...prev, [selectedPair.symbol]: null }));
             }
        }, 1000);
    };

    const handleSaveLayout = useCallback((symbol: string, layout: object) => {
        setChartLayouts(prev => ({ ...prev, [symbol]: layout }));
    }, []);
    
    const currentLayout = chartLayouts[selectedPair.symbol];
    const memoizedTradingViewWidget = useMemo(() => 
        <TradingViewWidget symbol={selectedPair.symbol} savedLayout={currentLayout} onSaveLayout={handleSaveLayout} />,
    [selectedPair.symbol, currentLayout, handleSaveLayout]);

    const currentAnalysis = analysisCache[selectedPair.symbol];
    const isLoading = loadingStates[selectedPair.symbol] ?? !currentAnalysis;
    const error = errorStates[selectedPair.symbol] || null;
    const uploadedImageUrl = uploadedImageCache[selectedPair.symbol];

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <div>
                    <header className="mb-6 print-header">
                        <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">Market Analysis</h1>
                        <p className="text-slate-400 mt-1">{formattedDate}</p>
                        <p className="text-slate-400 mt-1">Powered by Gemini & TradingView</p>
                    </header>
                    <nav className="mb-6 print-hidden">
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded-lg">
                            {TRADING_PAIRS.map(pair => (
                                <button key={pair.symbol} onClick={() => setSelectedPair(pair)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 ${selectedPair.symbol === pair.symbol ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                    {pair.name}
                                </button>
                            ))}
                            <div className="ml-auto flex items-center gap-2">
                                <button onClick={handleRefresh} disabled={isLoading || isPdfSaving} className="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center disabled:bg-slate-500 disabled:cursor-wait" aria-label="Refresh analysis">
                                    {isLoading ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Refreshing...</>) : ("Refresh")}
                                </button>
                                <button onClick={handlePrintToPdf} disabled={isPdfSaving || isLoading} className="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center disabled:bg-slate-500 disabled:cursor-wait" aria-label="Save as PDF">
                                    {isPdfSaving ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Saving PDF...</>) : ("Save as PDF")}
                                </button>
                                <button onClick={handleDirectPrint} disabled={isPdfSaving || isLoading} className="p-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center disabled:bg-slate-500 disabled:cursor-wait" aria-label="Print page with light theme">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m10 0v-5H7v5m10 0v4H7v-4m10-9V3H7v5" /></svg>
                                </button>
                            </div>
                        </div>
                    </nav>
                    <main>
                        <div className="mb-8">
                             {uploadedImageUrl ? (
                                <div className="printable-section h-[50vh] md:h-[60vh] rounded-lg overflow-hidden border-2 border-slate-700 shadow-lg bg-slate-800 flex items-center justify-center p-2">
                                    <img src={uploadedImageUrl} id="uploaded-chart-image" alt="User uploaded chart for analysis" className="max-h-full max-w-full object-contain" />
                                </div>
                            ) : (
                                <div className="printable-section print-hidden">{memoizedTradingViewWidget}</div>
                            )}
                        </div>

                        <SummaryDisplay 
                            summary={currentAnalysis?.summary ?? null} 
                            sources={currentAnalysis?.sources ?? null} 
                            isLoading={isLoading} 
                            error={error} 
                            onAnalyzeImage={handleAnalyzeImage} 
                            isAnalyzingImage={isAnalyzingImage}
                        />
                    </main>
                </div>
                <footer className="text-center mt-12 text-slate-500 text-sm print-hidden">
                    <p>Disclaimer: This analysis is AI-generated and for informational purposes only. It is not financial advice. Prices from OANDA may be delayed.</p>
                </footer>
            </div>
        </div>
    );
};

export default App;