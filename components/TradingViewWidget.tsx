import React, { useEffect, useRef, memo } from 'react';

// Declare the TradingView global object
declare const TradingView: any;

interface TradingViewWidgetProps {
    symbol: string;
    savedLayout?: object;
    onSaveLayout: (symbol: string, layout: object) => void;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol, savedLayout, onSaveLayout }) => {
    const container = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<any>(null);

    useEffect(() => {
        // This effect runs when `symbol` changes. The cleanup function will run for the *previous* symbol.
        if (container.current && typeof TradingView !== 'undefined') {
            // Clear previous widget if any
            container.current.innerHTML = '';
            
            const tvWidget = new TradingView.widget({
                autosize: true,
                symbol: symbol,
                interval: "30",
                timezone: "Etc/UTC",
                theme: "dark",
                style: "1",
                locale: "en",
                enable_publishing: false,
                hide_side_toolbar: false,
                allow_symbol_change: false,
                container_id: container.current.id,
                saved_data: savedLayout, // Load the saved layout for this symbol
            });
            widgetRef.current = tvWidget;
        }
        
        // This cleanup function is crucial. It runs before the effect re-runs for a new symbol.
        return () => {
            if (widgetRef.current && typeof widgetRef.current.save === 'function') {
                widgetRef.current.save().then((layout: object) => {
                    // The `symbol` here is from the closure of the previous render,
                    // so it correctly saves the layout for the symbol we are leaving.
                    onSaveLayout(symbol, layout);
                }).catch((err: any) => {
                    console.error("Failed to save chart layout:", err);
                });
            }
        };
    // The dependency array ensures this effect re-runs only when the symbol changes.
    // The onSaveLayout function is expected to be stable (wrapped in useCallback).
    }, [symbol, onSaveLayout]);

    return (
        <div className="h-[50vh] md:h-[60vh] rounded-lg overflow-hidden border-2 border-slate-700 shadow-lg">
            <div ref={container} id={`tradingview_widget_${symbol}`} className="h-full w-full" />
        </div>
    );
};

export default memo(TradingViewWidget);