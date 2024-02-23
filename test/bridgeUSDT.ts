import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();
import { CrossBridge, CrossBridge__factory, ERC20, ERC20__factory } from "../src";
import * as utils from "./utils";


async function main() {
    
    const [goerliCrossBridgeAddress, hobbyCrossBridgeAddress] = utils.readCrossBridgeAddress();
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);

    const goerliProvider = new ethers.providers.InfuraProvider("goerli", process.env.INFURA_API_KEY);
    const goerliWallet = wallet.connect(goerliProvider);
    const hobbyProvider = new ethers.providers.JsonRpcProvider("http://103.39.218.177:8545", 9001);
    const hobbyWallet = wallet.connect(hobbyProvider);

    const goerliCrossBridge = CrossBridge__factory.connect(goerliCrossBridgeAddress, goerliWallet);
    const hobbyCrossBridge = CrossBridge__factory.connect(hobbyCrossBridgeAddress, hobbyWallet);

    const goerliUsdtAddress = utils.readGoerliUsdtAddress();
    const bridgeAmount = ethers.utils.parseUnits('100', 6n);

    const usdtToken = ERC20__factory.connect(goerliUsdtAddress, goerliWallet);
    const approveTX = await usdtToken.approve(goerliCrossBridge.address, bridgeAmount);
    await approveTX.wait();

    const bridgeTokensTX = await goerliCrossBridge.bridgeTokens(
        goerliUsdtAddress,
        bridgeAmount,
        9001n,
        wallet.address
    );
    await bridgeTokensTX.wait();
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});