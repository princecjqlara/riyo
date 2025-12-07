const fs = require('fs');
const decompress = require('decompress');

const nvai_url = "https://ai.api.nvidia.com/v1/cv/nvidia/retail-object-detection";
const header_auth = "Bearer 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";

async function _upload_asset(input, description) {
    const assets_url = "https://api.nvcf.nvidia.com/v2/nvcf/assets";

    const headers = {
        "Authorization": header_auth,
        "Content-Type": "application/json",
        "accept": "application/json",
    };

    const s3_headers = {
        "x-amz-meta-nvcf-asset-description": description,
        "content-type": "video/mp4",
    };

    const payload = {
        "contentType": "video/mp4",
        "description": description
    };

    const response = await fetch(
        assets_url, { method: 'POST', body: JSON.stringify(payload), headers: headers }
    );

    const data = await response.json();

    const asset_url = data["uploadUrl"];
    const asset_id = data["assetId"];

    const fileData = fs.readFileSync(input);

    await fetch(
        asset_url,
        { method: 'PUT', body: fileData, headers: s3_headers }
    );

    return asset_id.toString();
}

(async () => {
    if (process.argv.length != 4) {
        console.log("Usage: node nvidia-retail-detection.js <input_video> <output_dir>");
        process.exit(1);
    }

    console.log("Uploading video asset...");

    // Upload specified user asset
    const asset_id = await _upload_asset(`${process.argv[2]}`, "Input Video");
    console.log(`Asset uploaded with ID: ${asset_id}`);

    // Metadata for the request
    const inputs = { "input_video": asset_id, "threshold": 0.9 };
    const asset_list = asset_id;
    const headers = {
        "Content-Type": "application/json",
        "NVCF-INPUT-ASSET-REFERENCES": asset_list,
        "NVCF-FUNCTION-ASSET-IDS": asset_list,
        "Authorization": header_auth
    };

    console.log("Processing video with NVIDIA Retail Object Detection...");

    // Make the request to nvcf
    const response = await fetch(nvai_url, {
        method: 'POST', body: JSON.stringify(inputs), headers: headers
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error: ${response.status} - ${errorText}`);
        process.exit(1);
    }

    // Gather the binary response data
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const zipname = `${process.argv[3]}.zip`;
    fs.writeFileSync(zipname, buffer);

    // Unzip the response synchronously
    await decompress(zipname, process.argv[3]);

    // Log the output directory and its contents
    console.log(`Response saved to ${process.argv[3]}`);
    console.log("Output files:", fs.readdirSync(process.argv[3]));
})();
