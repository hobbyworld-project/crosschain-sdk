import * as fs from "fs";


export function readCrossBridgeAddress(): [string, string] {

    const filePath = "./README.md";
    const data = fs.readFileSync(filePath, 'utf8');

    const goerliMatch = data.match(/Goerli: \s*(0x[a-fA-F0-9]+)/);
    const hobbyMatch = data.match(/Hobby: \s*(0x[a-fA-F0-9]+)/);

    if (goerliMatch && hobbyMatch) {
        const goerliCrossBridgeAddress = goerliMatch[1];
        const hobbyCrossBridgeAddress = hobbyMatch[1];
        return [goerliCrossBridgeAddress, hobbyCrossBridgeAddress];
    } else {
        throw "can not find goerli crossbridge contract address";
    }
}

export function readGoerliUsdtAddress() {

    const filePath = "./README.md";
    const data = fs.readFileSync(filePath, 'utf8');

    const match = data.match(/Goerli USDT: \s*(0x[a-fA-F0-9]+)/)
    if (match) {
        const usdtAddress = match[1];
        return usdtAddress;
    } else {
        throw "can not find goerli usdt address";
    }
}