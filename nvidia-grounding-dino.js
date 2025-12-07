const fs = require('fs');
const path = require('path');
const decompress = require('decompress');
const { setTimeout } = require('timers/promises');

const nvai_url = "https://ai.api.nvidia.com/v1/cv/nvidia/nv-grounding-dino";
const nvai_polling_url = "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/";
const header_auth = "Bearer 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";

// Constants for polling
const MAX_RETRIES = 30;
const DELAY_BTW_RETRIES = 2000; // in milliseconds (2 seconds)

// Get content type based on file extension
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/jpeg';
}

async function _upload_asset(input, description) {
    const assets_url = "https://api.nvcf.nvidia.com/v2/nvcf/assets";
    const contentType = getContentType(input);

    const headers = {
        "Authorization": header_auth,
        "Content-Type": "application/json",
        "accept": "application/json",
    };

    const s3_headers = {
        "x-amz-meta-nvcf-asset-description": description,
        "content-type": contentType,
    };

    const payload = {
        "contentType": contentType,
        "description": description
    };

    console.log(`Uploading image with content type: ${contentType}`);

    const response = await fetch(
        assets_url, { method: 'POST', body: JSON.stringify(payload), headers: headers }
    );

    const data = await response.json();

    if (!data.uploadUrl || !data.assetId) {
        console.error("Failed to get upload URL:", data);
        process.exit(1);
    }

    const asset_url = data["uploadUrl"];
    const asset_id = data["assetId"];

    const fileData = fs.readFileSync(input);

    await fetch(
        asset_url,
        { method: 'PUT', body: fileData, headers: s3_headers }
    );

    console.log(`Asset uploaded successfully. ID: ${asset_id}`);
    return asset_id.toString();
}

(async () => {
    if (process.argv.length != 5) {
        console.log("Usage: node nvidia-grounding-dino.js <prompt> <input_image> <output_dir>");
        console.log("");
        console.log("Example: node nvidia-grounding-dino.js \"person. shopping cart. product.\" store.jpg results");
        process.exit(1);
    }

    const prompt = process.argv[2];
    const inputImage = process.argv[3];
    const outputDir = process.argv[4];

    console.log(`\nPrompt: "${prompt}"`);
    console.log(`Input image: ${inputImage}`);
    console.log(`Output directory: ${outputDir}\n`);

    // Upload specified user asset
    const asset_id = await _upload_asset(inputImage, "Input Image");

    // Metadata for the request - using image format
    const inputs = {
        "model": "Grounding-Dino",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "media_url",
                        "media_url": {
                            "url": `data:image/jpeg;asset_id,${asset_id}`
                        }
                    }
                ]
            }
        ],
        "threshold": 0.3
    };

    const asset_list = asset_id;
    const headers = {
        "Content-Type": "application/json",
        "NVCF-INPUT-ASSET-REFERENCES": asset_list,
        "NVCF-FUNCTION-ASSET-IDS": asset_list,
        "Authorization": header_auth
    };

    console.log("Sending request to NVIDIA Grounding DINO...");

    // Make the request to nvcf
    const response = await fetch(nvai_url, {
        method: 'POST', body: JSON.stringify(inputs), headers: headers
    });

    if (response.status === 200) {
        // Evaluation complete, output ready
        console.log("Processing complete!");

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const zipname = `${outputDir}.zip`;
        fs.writeFileSync(zipname, buffer);

        // Unzip the response synchronously
        await decompress(zipname, outputDir);

        console.log(`\nResponse saved to ${outputDir}`);
        console.log("Output files:", fs.readdirSync(outputDir));

    } else if (response.status === 202) {
        // Pending evaluation
        console.log("Processing started, waiting for results...");
        const nvcf_reqid = response.headers.get('NVCF-REQID');
        let retries = MAX_RETRIES;

        while (retries > 0) {
            console.log(`Polling... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);

            const pollingResponse = await fetch(`${nvai_polling_url}${nvcf_reqid}`, {
                method: 'GET',
                headers: {
                    "accept": "application/json",
                    "Authorization": header_auth
                }
            });

            if (pollingResponse.status === 202) {
                // Evaluation still pending
                console.log('Still processing...');
                retries -= 1;
                await setTimeout(DELAY_BTW_RETRIES);
            } else if (pollingResponse.status === 200) {
                // Evaluation complete, output ready
                console.log('Processing complete!');

                const arrayBuffer = await pollingResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const zipname = `${outputDir}.zip`;
                fs.writeFileSync(zipname, buffer);

                // Unzip the response synchronously
                await decompress(zipname, outputDir);

                console.log(`\nResponse saved to ${outputDir}`);
                console.log("Output files:", fs.readdirSync(outputDir));
                break;
            } else {
                const errorText = await pollingResponse.text();
                console.error('Unexpected response status:', pollingResponse.status, errorText);
                break;
            }

            if (retries === 0) {
                console.error('Max retries reached. Processing timed out.');
            }
        }
    } else {
        const errorText = await response.text();
        console.error('Error:', response.status, errorText);
    }
})();
