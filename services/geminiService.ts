

import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { SummaryData, GroundingChunk, TechnicalAnalysis } from '../types';

// Initialize the Google AI client once using the environment variable.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });


// Helper function to remove grounding citations like [1], [2, 9] from text
const cleanText = (text: string): string => {
  if (!text) return '';
  return text.replace(/\s*\[[\d\s,]+\]/g, '').trim();
};

const getAnalysisTextPrompt = (pairName: string): string => {
  const today = new Date();
  const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });

  return `
Anda adalah seorang analis pasar keuangan ahli yang menyediakan ringkasan harian terperinci untuk pasangan trading: ${pairName}.
Tanggal hari ini adalah ${today.toDateString()}.

Gunakan Bahasa Indonesia yang natural dan jangan terlalu kaku. Istilah-istilah trading atau keuangan dalam Bahasa Inggris (seperti "support", "resistance", "bullish", "bearish", "outlook", nama-nama event berita) tidak perlu diterjemahkan.

Analisis Anda harus komprehensif dan mengikuti instruksi ini dengan tepat. Pengetahuan Anda didasarkan pada buku "The Wyckoff Methodology in Depth" dan "Wyckoff 2.0" oleh Rubén Villahermosa.

**Format Teks:**
- Gunakan markdown tebal (\`**...**\`) HANYA untuk judul bagian utama seperti "**Skenario Eksekusi**". Jangan gunakan format tebal untuk istilah-istilah individual di dalam paragraf.
- Letakkan setiap judul bagian utama (seperti "**Skenario Eksekusi**") pada barisnya sendiri, dengan satu baris kosong sebelum dan sesudahnya untuk pemisahan visual yang jelas.
- Berikan analisis lengkap dalam format teks. Pastikan untuk mencakup semua bagian yang diminta di bawah ini.

1.  **Fundamental News:** Ringkas berita fundamental penting terbaru yang mempengaruhi pasangan ini. Gunakan akses Google Search Anda untuk menemukan informasi yang relevan dan terkini.

2.  **Upcoming Economic Events:** Sebutkan semua acara ekonomi yang akan datang (termasuk yang berdampak High, Medium, dan Low) untuk 3 minggu ke depan yang dapat mempengaruhi pasangan ini. Sertakan tanggal, waktu (UTC), nama acara, dan potensi dampak (High, Medium, Low).

3.  **Daily Analysis Timeline:**
    - Jika hari ini adalah Senin (${dayOfWeek === 'Monday'}), berikan rekap singkat tentang pergerakan harga dan peristiwa penting minggu lalu. Kemudian, berikan analisis dan outlook terperinci untuk hari ini.
    - Jika bukan hari Senin, pertama-tama ulas pergerakan harga kemarin terhadap analisis sebelumnya (apakah sesuai atau tidak). Kemudian, berikan analisis dan outlook terperinci untuk hari ini.

4.  **Technical Analysis (30-Minute Timeframe):**
    - Analisis Anda HARUS didasarkan pada **Metodologi Wyckoff**.
    - Identifikasi fase pasar saat ini (Akumulasi, Distribusi, Mark-Up, atau Mark-Down).
    - Analisis struktur harga (price structures), profil volume (volume profile), dan alur pesanan (order flow) untuk menentukan di mana 'Smart Money' kemungkinan besar memposisikan diri.
    - Tentukan bias pasar saat ini ("Bullish", "Bearish", atau "Neutral") berdasarkan analisis Wyckoff Anda.
    - Berikan alasan yang jelas, sebutkan peristiwa-peristiwa Wyckoff yang relevan yang Anda amati (misalnya, Preliminary Support/Supply, Selling/Buying Climax, Automatic Rally/Reaction, Secondary Tests, Springs, Upthrusts, Signs of Strength/Weakness).
    - **PENTING:** Setiap kali Anda menyebutkan level teknikal kunci (seperti support, resistance, Creek, Ice, Spring, Upthrust), sertakan perkiraan level harga. Contoh: 'harga saat ini sedang menguji level support di sekitar 1850.50' atau 'terlihat Spring di bawah support 1.2500'.

5.  **Correlated Summary & Execution Scenario:**
    - Gabungkan ringkasan dan skenario eksekusi menjadi satu teks.
    - **Ringkasan Korelasi:** Sintesiskan berita fundamental, acara mendatang, dan analisis teknis Wyckoff menjadi sebuah ringkasan yang kohesif. Jelaskan bagaimana faktor fundamental dapat mendukung atau bertentangan dengan bias teknis. Berikan outlook penutup untuk hari ini.
    - **Skenario Eksekusi:** Setelah ringkasan, tambahkan bagian berjudul "**Skenario Eksekusi**". Skenario ini HARUS mencakup:
        - **Aksi:** Tentukan dengan jelas "Buy" atau "Sell".
        - **Entry Point:** Perkiraan level harga untuk masuk.
        - **Target Price:** Tetapkan target harga yang realistis.
        - **Stop Loss:** Tetapkan level stop loss untuk manajemen risiko.
        - **Justifikasi:** Berikan alasan yang jelas untuk SETIAP level harga (Entry, Target, Stop Loss) berdasarkan level-level kunci dari analisis teknikal Wyckoff yang telah Anda identifikasi sebelumnya. Contoh justifikasi: "Stop Loss ditempatkan sedikit di bawah level Spring (sekitar 1.2450) karena penembusan di bawahnya akan membatalkan bias bullish." atau "Target Price ditetapkan pada resistance dari Creek sebelumnya (sekitar 1.2600) karena area tersebut kemungkinan akan diuji kembali."
`;
};

export const generateMarketSummary = async (pairName: string): Promise<{ summary: SummaryData; sources: GroundingChunk[] }> => {
  try {
    // Step 1: Get the text analysis using Google Search
    const textPrompt = getAnalysisTextPrompt(pairName);

    const textResponse: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: textPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    });
    
    const analysisText = textResponse.text ?? '';
    const sources: GroundingChunk[] = textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Step 2: Structure the text into JSON using a schema
    const jsonPrompt = `
      Berdasarkan teks analisis pasar berikut, ekstrak informasi dan format ke dalam objek JSON.
      Pastikan semua bidang diisi. Untuk "upcomingEvents", ekstrak semua peristiwa yang disebutkan.
      Untuk "dailyAnalysis", pisahkan rekap dari outlook hari ini.
      Untuk "technicalAnalysis", ekstrak bias dan alasannya.
      Untuk "correlatedSummary", sertakan ringkasan korelasi dan juga bagian "**Skenario Eksekusi**".

      Teks Analisis:
      ---
      ${analysisText}
      ---
    `;

    const jsonResponse: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: jsonPrompt,
        config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    fundamentalNews: { type: Type.STRING },
                    upcomingEvents: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                date: { type: Type.STRING },
                                time: { type: Type.STRING },
                                event: { type: Type.STRING },
                                impact: { type: Type.STRING }
                            },
                        }
                    },
                    dailyAnalysis: {
                        type: Type.OBJECT,
                        properties: {
                            recap: { type: Type.STRING },
                            todayOutlook: { type: Type.STRING }
                        },
                    },
                    technicalAnalysis: {
                        type: Type.OBJECT,
                        properties: {
                            bias: { type: Type.STRING },
                            reasoning: { type: Type.STRING }
                        },
                    },
                    correlatedSummary: { type: Type.STRING }
                },
            },
        },
    });
    
    const jsonString = (jsonResponse.text ?? '').trim();
    const partialSummary: Partial<SummaryData> = JSON.parse(jsonString);

    // Ensure the summary object is complete to prevent runtime errors in the UI
    const summary: SummaryData = {
        fundamentalNews: cleanText(partialSummary.fundamentalNews || ''),
        upcomingEvents: partialSummary.upcomingEvents || [],
        dailyAnalysis: {
            recap: cleanText(partialSummary.dailyAnalysis?.recap || ''),
            todayOutlook: cleanText(partialSummary.dailyAnalysis?.todayOutlook || ''),
        },
        technicalAnalysis: {
            bias: partialSummary.technicalAnalysis?.bias || 'Neutral',
            reasoning: cleanText(partialSummary.technicalAnalysis?.reasoning || ''),
        },
        correlatedSummary: cleanText(partialSummary.correlatedSummary || ''),
    };
    
    return { summary, sources };
  } catch (error) {
    console.error("Error generating market summary:", error);
    if (error instanceof SyntaxError) {
      console.error("Invalid JSON response received:", (error as any).message);
      throw new Error("Failed to parse AI response. The format was invalid.");
    }
    throw new Error("An error occurred while fetching the market analysis.");
  }
};


const getImageAnalysisPrompt = (pairName: string, existingSummary: SummaryData): string => {
  return `
Anda adalah seorang analis teknikal pasar keuangan, seorang ahli dalam Metodologi Wyckoff. Tugas Anda adalah menganalisis gambar chart yang dilampirkan untuk pasangan trading: ${pairName}.

**Aturan Analisis Gambar (Metodologi Wyckoff):**
- Analisis gambar chart secara eksklusif menggunakan prinsip-prinsip Metodologi Wyckoff.
- Cari skema Akumulasi atau Distribusi Wyckoff dalam gambar.
- Identifikasi peristiwa-peristiwa kunci Wyckoff (misalnya, Climax, Reaction, Springs, Upthrusts, Signs of Strength/Weakness) dan fase pasar saat ini.
- **PENTING:** Perkirakan dan sebutkan level harga untuk setiap struktur atau peristiwa yang Anda identifikasi. Contoh: 'terlihat Spring di bawah support 1.2500'.
- Tentukan bias teknikal ("Bullish", "Bearish", atau "Neutral") berdasarkan apa yang Anda lihat.
- Berikan alasan singkat berdasarkan pengamatan visual Anda terhadap struktur harga dan pola volume (jika terlihat) pada chart.

**Konteks Tambahan (Jangan diubah, gunakan untuk korelasi):**
- **Berita Fundamental Terkini:** ${existingSummary.fundamentalNews}
- **Outlook Harian:** ${existingSummary.dailyAnalysis.todayOutlook}

**Format Teks:**
- Gunakan markdown tebal (\`**...**\`) HANYA untuk judul "**Skenario Eksekusi**".
- Letakkan judul "**Skenario Eksekusi**" pada barisnya sendiri, dengan satu baris kosong sebelum dan sesudahnya untuk pemisahan visual yang jelas.

**Tugas Anda:**
1. Hasilkan analisis teknikal berdasarkan gambar.
2. Di dalam field JSON "correlatedSummary", gabungkan ringkasan korelasi BARU dan skenario eksekusi menjadi satu teks.
3. **Ringkasan Korelasi:** Gabungkan analisis gambar Anda dengan konteks fundamental dan outlook harian.
4. **Skenario Eksekusi:** Setelah ringkasan korelasi, tambahkan bagian "**Skenario Eksekusi**". Skenario ini HARUS mencakup:
    - **Aksi:** Tentukan dengan jelas "Buy" atau "Sell".
    - **Entry Point:** Perkiraan level harga untuk masuk.
    - **Target Price:** Tetapkan target harga yang realistis.
    - **Stop Loss:** Tetapkan level stop loss untuk manajemen risiko.
    - **Justifikasi:** Berikan alasan yang jelas untuk SETIAP level harga (Entry, Target, Stop Loss) berdasarkan level-level kunci dari analisis teknikal Wyckoff yang Anda identifikasi dari gambar.

Respons Anda HARUS berupa objek JSON tunggal.
`;
};

interface ImageAnalysisResult {
    technicalAnalysis: TechnicalAnalysis;
    correlatedSummary: string;
}

export const generateImageBasedAnalysis = async (
    imageData: { data: string; mimeType: string; },
    pairName: string,
    existingSummary: SummaryData
): Promise<ImageAnalysisResult> => {
    try {
        const prompt = getImageAnalysisPrompt(pairName, existingSummary);

        const imagePart = {
            inlineData: {
                data: imageData.data,
                mimeType: imageData.mimeType,
            },
        };
        const textPart = { text: prompt };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [textPart, imagePart] },
            config: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        technicalAnalysis: {
                            type: Type.OBJECT,
                            properties: {
                                bias: { type: Type.STRING },
                                reasoning: { type: Type.STRING },
                            },
                        },
                        correlatedSummary: { type: Type.STRING },
                    },
                },
            },
        });

        const text = response.text ?? '';
        const jsonString = text.replace(/^```json\s*|```\s*$/g, '').trim();
        const partialResult: Partial<ImageAnalysisResult> = JSON.parse(jsonString);
        
        // Ensure the result object is complete to prevent runtime errors
        const result: ImageAnalysisResult = {
            technicalAnalysis: {
                bias: partialResult.technicalAnalysis?.bias || 'Neutral',
                reasoning: cleanText(partialResult.technicalAnalysis?.reasoning || ''),
            },
            correlatedSummary: cleanText(partialResult.correlatedSummary || ''),
        };

        return result;

    } catch (error) {
        console.error("Error generating image-based analysis:", error);
        if (error instanceof SyntaxError) {
            console.error("Invalid JSON response received from image analysis:", (error as any).message);
            throw new Error("Failed to parse AI response from image. The format was invalid.");
        }
        throw new Error("An error occurred while analyzing the chart image.");
    }
};