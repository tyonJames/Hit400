import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  makeContractCall,
  broadcastTransaction,
  callReadOnlyFunction,
  uintCV,
  principalCV,
  bufferCV,
  cvToValue,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly network;
  private readonly contractAddress: string;
  private readonly contractName: string;

  constructor(private configService: ConfigService) {
    const networkName = configService.get<string>('STACKS_NETWORK', 'testnet');
    this.network = networkName === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
    this.contractAddress = configService.get<string>('CLARITY_CONTRACT_ADDRESS', '');
    this.contractName    = configService.get<string>('STACKS_CONTRACT_NAME', 'blockland');
  }

  // ---------------------------------------------------------------------------
  // REGISTER PROPERTY
  // ---------------------------------------------------------------------------
  async registerProperty(params: {
    propertyId:    number;
    titleDeedHash: string; // hex string
    ownerAddress:  string;
    ipfsHash:      string;
    senderKey:     string;
  }): Promise<string> {
    try {
      const [addr, name] = this.contractAddress.split('.');
      const tx = await makeContractCall({
        contractAddress:  addr,
        contractName:     name ?? this.contractName,
        functionName:     'register-property',
        functionArgs: [
          uintCV(params.propertyId),
          bufferCV(Buffer.from(params.titleDeedHash, 'hex')),
          principalCV(params.ownerAddress),
          bufferCV(Buffer.from(params.ipfsHash)),
        ],
        senderKey:         params.senderKey,
        network:           this.network,
        anchorMode:        AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
      });

      const result = await broadcastTransaction(tx, this.network);
      if ('error' in result) throw new Error(result.error);
      this.logger.log(`register-property txid: ${result.txid}`);
      return result.txid;
    } catch (err) {
      this.logger.error('registerProperty failed', err);
      throw new InternalServerErrorException('Blockchain: register-property failed.');
    }
  }

  // ---------------------------------------------------------------------------
  // INITIATE TRANSFER
  // ---------------------------------------------------------------------------
  async initiateTransfer(params: {
    propertyId:  number;
    buyerAddress: string;
    senderKey:   string;
  }): Promise<string> {
    const [addr, name] = this.contractAddress.split('.');
    const tx = await makeContractCall({
      contractAddress:  addr,
      contractName:     name ?? this.contractName,
      functionName:     'initiate-transfer',
      functionArgs:     [uintCV(params.propertyId), principalCV(params.buyerAddress)],
      senderKey:        params.senderKey,
      network:          this.network,
      anchorMode:       AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });
    const result = await broadcastTransaction(tx, this.network);
    if ('error' in result) throw new InternalServerErrorException('Blockchain: initiate-transfer failed.');
    return result.txid;
  }

  // ---------------------------------------------------------------------------
  // FINALIZE TRANSFER
  // ---------------------------------------------------------------------------
  async finalizeTransfer(params: { propertyId: number; senderKey: string }): Promise<string> {
    const [addr, name] = this.contractAddress.split('.');
    const tx = await makeContractCall({
      contractAddress:  addr,
      contractName:     name ?? this.contractName,
      functionName:     'registrar-finalize-transfer',
      functionArgs:     [uintCV(params.propertyId)],
      senderKey:        params.senderKey,
      network:          this.network,
      anchorMode:       AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });
    const result = await broadcastTransaction(tx, this.network);
    if ('error' in result) throw new InternalServerErrorException('Blockchain: finalize-transfer failed.');
    return result.txid;
  }

  // ---------------------------------------------------------------------------
  // FLAG DISPUTE
  // ---------------------------------------------------------------------------
  async flagDispute(params: { propertyId: number; senderKey: string }): Promise<string> {
    const [addr, name] = this.contractAddress.split('.');
    const tx = await makeContractCall({
      contractAddress:  addr,
      contractName:     name ?? this.contractName,
      functionName:     'flag-dispute',
      functionArgs:     [uintCV(params.propertyId)],
      senderKey:        params.senderKey,
      network:          this.network,
      anchorMode:       AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });
    const result = await broadcastTransaction(tx, this.network);
    if ('error' in result) throw new InternalServerErrorException('Blockchain: flag-dispute failed.');
    return result.txid;
  }

  // ---------------------------------------------------------------------------
  // RESOLVE DISPUTE
  // ---------------------------------------------------------------------------
  async resolveDispute(params: { propertyId: number; senderKey: string }): Promise<string> {
    const [addr, name] = this.contractAddress.split('.');
    const tx = await makeContractCall({
      contractAddress:  addr,
      contractName:     name ?? this.contractName,
      functionName:     'resolve-dispute',
      functionArgs:     [uintCV(params.propertyId)],
      senderKey:        params.senderKey,
      network:          this.network,
      anchorMode:       AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });
    const result = await broadcastTransaction(tx, this.network);
    if ('error' in result) throw new InternalServerErrorException('Blockchain: resolve-dispute failed.');
    return result.txid;
  }

  // ---------------------------------------------------------------------------
  // READ-ONLY: VERIFY OWNER
  // ---------------------------------------------------------------------------
  async verifyOwner(propertyId: number): Promise<{ owner: string | null; status: string | null }> {
    try {
      const [addr, name] = this.contractAddress.split('.');
      const result = await callReadOnlyFunction({
        contractAddress: addr,
        contractName:    name ?? this.contractName,
        functionName:    'get-property',
        functionArgs:    [uintCV(propertyId)],
        network:         this.network,
        senderAddress:   addr,
      });
      const value = cvToValue(result);
      if (!value) return { owner: null, status: null };
      return { owner: value.owner ?? null, status: value.status ?? null };
    } catch {
      return { owner: null, status: null };
    }
  }

  // ---------------------------------------------------------------------------
  // READ-ONLY: GET OWNERSHIP HISTORY ENTRY
  // ---------------------------------------------------------------------------
  async getOwnershipHistoryEntry(
    propertyId: number,
    seq: number,
  ): Promise<{ owner: string; acquiredAt: number } | null> {
    try {
      const [addr, name] = this.contractAddress.split('.');
      const result = await callReadOnlyFunction({
        contractAddress: addr,
        contractName:    name ?? this.contractName,
        functionName:    'get-ownership-history-entry',
        functionArgs:    [uintCV(propertyId), uintCV(seq)],
        network:         this.network,
        senderAddress:   addr,
      });
      const value = cvToValue(result);
      if (!value) return null;
      return { owner: value.owner, acquiredAt: Number(value['acquired-at']) };
    } catch {
      return null;
    }
  }
}
