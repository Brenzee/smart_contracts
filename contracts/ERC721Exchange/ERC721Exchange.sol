// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

struct Sale {
    address token;
    uint256 tokenId;
    address currency;
    uint256 price;
    uint256 expiresAt;
}

struct Signature {
    bytes32 r;
    bytes32 s;
    uint8 v;
}

/**
 * @author Brendons Karelis
 * @notice ERC721 Exchange
 */
contract ERC721Exchange {
    using SafeERC20 for IERC20;

    address public owner;
    address public feeRecipient;

    /** @dev EIP712 Data */
    string public constant NAME = "ERC721 Exchange";
    string public constant VERSION = "1";
    bytes32 public immutable DOMAIN_SEPARATOR;
    uint256 public immutable CHAIN_ID;
    bytes32 public immutable SALT;
    bytes32 public constant SALE_TYPEHASH =
        keccak256("Sale(address token,uint256 tokenId,address currency,uint256 price,uint256 expiresAt)");

    /** @dev Seller fee, that can be changed by the contracts owner */
    uint256 public SELLER_FEE = 20;

    mapping(address => bool) public supportedTokens; // Set supported ERC20 tokens, that can be used to pay for the sale
    mapping(address => mapping(bytes32 => bool)) public invalidSales; // Set invalid sales, that can be used to prevent a sale from being executed

    event Received(address, uint256);

    constructor(address _feeRecipient) {
        uint256 id;
        assembly {
            id := chainid()
        }
        CHAIN_ID = id;
        SALT = bytes32(((uint256(blockhash(block.number - 1)) << 192) >> 16) | uint256(uint160(address(this))));
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"),
                keccak256(bytes(NAME)),
                keccak256(bytes(VERSION)),
                CHAIN_ID,
                address(this),
                SALT
            )
        );
        owner = msg.sender;
        feeRecipient = _feeRecipient;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ERC721Exchange: only owner");
        _;
    }

    modifier onlySigner(Sale calldata sale, Signature calldata signature) {
        (address signer, ) = getSigner(sale, signature.r, signature.s, signature.v);
        require(signer == msg.sender, "ERC721Exchange: only signer");
        _;
    }

    /**
     * @notice Buy an NFT with ETH or ERC20. The NFT is transferred to the buyer (msg.sender), and the seller receives the ETH or ERC20
     * @param sale The sale details
     * @param r The signature r value
     * @param s The signature s value
     * @param v The signature v value
     * @dev The signature is generated by the NFT owner, that wants to sell the NFT
     */
    function buyToken(Sale calldata sale, bytes32 r, bytes32 s, uint8 v) public payable {
        require(block.timestamp < sale.expiresAt, "ERC721Exchange: sale expired");

        (address signer, bytes32 digest) = getSigner(sale, r, s, v);
        require(!invalidSales[signer][digest], "ERC721Exchange: sale is invalid");

        address tokenOwner = IERC721(sale.token).ownerOf(sale.tokenId);
        require(signer == tokenOwner, "ERC721Exchange: signer is not owner");

        if (sale.currency == address(0)) {
            _buyWithETH(sale, signer);
        } else {
            _buyWithERC20(sale, signer);
        }
    }

    function setInvalidSale(Sale calldata sale, Signature calldata signature, bool invalid) public onlySigner(sale, signature) {
        invalidSales[msg.sender][getDigest(sale)] = invalid;
    }

    function setSellerFee(uint256 fee) public onlyOwner {
        SELLER_FEE = fee;
    }

    function setSupportedToken(address token, bool supported) public onlyOwner {
        supportedTokens[token] = supported;
    }

    function getSigner(Sale calldata sale, bytes32 r, bytes32 s, uint8 v) public view returns (address signer, bytes32 digest) {
        digest = getDigest(sale);
        signer = ecrecover(digest, v, r, s);
    }

    function getDigest(Sale calldata sale) public view returns (bytes32 digest) {
        digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(SALE_TYPEHASH, sale.token, sale.tokenId, sale.currency, sale.price, sale.expiresAt))
            )
        );
    }

    function _buyWithETH(Sale calldata sale, address signer) internal {
        require(msg.value == sale.price, "ERC721Exchange: invalid price");
        IERC721(sale.token).safeTransferFrom(signer, msg.sender, sale.tokenId);

        uint256 sellerFee = (sale.price * SELLER_FEE) / 1000;

        payable(signer).transfer(sale.price - sellerFee);
        payable(feeRecipient).transfer(sellerFee);
    }

    function _buyWithERC20(Sale calldata sale, address signer) internal {
        require(supportedTokens[sale.currency], "ERC721Exchange: unsupported token");

        IERC721(sale.token).safeTransferFrom(signer, msg.sender, sale.tokenId);

        uint256 sellerFee = (sale.price * SELLER_FEE) / 1000;

        IERC20(sale.currency).safeTransferFrom(msg.sender, signer, sale.price - sellerFee);
        IERC20(sale.currency).safeTransferFrom(msg.sender, feeRecipient, sellerFee);
    }
}
