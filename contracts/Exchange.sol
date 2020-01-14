pragma solidity ^0.4.22;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract Exchange {
  using SafeMath for uint;

  bool public negativeFees;
  bool public inactive;
  bool public contractManualWithdraws;
  address public server;
  address public owner;
  address public feeCollector;
  mapping (address => mapping (address => uint)) public balances;
  mapping (bytes32 => uint) public orderFills;
  mapping (bytes32 => bool) public traded;
  mapping (address => bool) public accountManualWithdraws;
  mapping (address => uint256) public cancelledOrders;
  mapping (bytes32 => bool) public cancelled;

  event Deposit(address token, address account, uint amount, uint balance);

  constructor() public {
    server = msg.sender;
    feeCollector = msg.sender;
    owner = msg.sender;
  }

  modifier onlyActive {
    require(inactive == false);
    _;
  }

  modifier onlyServer {
 	  require(msg.sender == server);
    _;
  }

  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  modifier onlyOwnerOrServer {
    require(msg.sender == owner || msg.sender == server);
    _;
  }

  function setNegativeFees(bool _status) public onlyOwner {
    negativeFees = _status;
  }

  function setInactive(bool _status) public onlyOwner {
    inactive = _status;
  }

  function setContractManualWithdraws(bool _status) public onlyOwner {
    contractManualWithdraws = _status;
  }

  function setAccountManualWithdraws(address _account, bool _status) public onlyOwnerOrServer {
    accountManualWithdraws[_account] = _status;
  }

  function changeFeeCollector(address _feeCollector) public onlyOwner {
    feeCollector = _feeCollector;
  }

  function changeServer(address _server) public onlyOwner {
    server = _server;
  }

  function changeOwner(address _owner) public onlyOwner {
    owner = _owner;
  }

  function deposit() public payable onlyActive {
    balances[0][msg.sender] = balances[0][msg.sender].add(msg.value);
    emit Deposit(address(0), msg.sender, msg.value, balances[0][msg.sender]);
  }

  function depositToken(address _token, address _account, uint _amount) public onlyServer onlyActive {
    balances[_token][_account] = balances[_token][_account].add(_amount);
    require(ERC20(_token).transferFrom(_account, this, _amount));
    emit Deposit(_token, _account, _amount, balances[_token][_account]);
  }

  function withdraw(address _token, uint _amount, address _account, uint _fee) public onlyServer {
    require(balances[_token][_account] >= _amount);
    balances[_token][_account] = balances[_token][_account].sub(_amount);
    if (_fee > 50 finney) _fee = 50 finney;
    _fee = (_fee.mul(_amount)).div(1 ether);
    balances[_token][feeCollector] = balances[_token][feeCollector].add(_fee);
    _amount = _amount.sub(_fee);
    if (_token == 0) {
      require(_account.send(_amount));
    } else {
      require(ERC20(_token).transfer(_account, _amount));
    }
  }

  function directWithdraw(address _token, uint _amount) public {
    require(contractManualWithdraws || accountManualWithdraws[msg.sender]);
    require(balances[_token][msg.sender] >= _amount);
    balances[_token][msg.sender] = balances[_token][msg.sender].sub(_amount);
    if (_token == 0) {
      require(msg.sender.send(_amount));
    } else {
      require(ERC20(_token).transfer(msg.sender, _amount));
    }
  }

  function trade(address[] _addresses, uint[] _uints, uint8[] v, bytes32[] rs) public onlyServer {
    /*
      _addresses[0] == maker
      _addresses[1] == taker
      _addresses[2] == giveToken
      _addresses[3] == takeToken
      _uints[0] == giveAmount
      _uints[1] == takeAmount
      _uints[2] == fillAmount
      _uints[3] == makerNonce
      _uints[4] == takerNonce
      _uints[5] == makerFee
      _uints[6] == takerFee
      _uints[7] == expiry
      v[0] == makerV
      v[1] == takerV
      rs[0]..[1] == makerR, makerS
      rs[2]..[3] == takerR, takerS
    */
    require(cancelledOrders[_addresses[0]] < _uints[3]);
    bytes32 orderHash = keccak256(abi.encodePacked(this, _addresses[0], _addresses[2], _uints[0], _addresses[3], _uints[1], _uints[3], _uints[7]));
    require(!cancelled[orderHash]);
    require(recover(orderHash, v[0], rs[0], rs[1]) == _addresses[0]);
    bytes32 tradeHash = keccak256(abi.encodePacked(this, orderHash, _addresses[1], _uints[2], _uints[4]));
    require(recover(tradeHash, v[1], rs[2], rs[3]) == _addresses[1]);
    require(!traded[tradeHash]);
    traded[tradeHash] = true;
    if (_uints[5] > 5 finney) _uints[5] = 5 finney;
    if (_uints[6] > 5 finney) _uints[6] = 5 finney;
    require(balances[_addresses[2]][_addresses[0]] >= _uints[2]);
    require(balances[_addresses[3]][_addresses[1]] >= _uints[1].mul(_uints[2]).div(_uints[0]));
    require(orderFills[orderHash].add(_uints[2]) <= _uints[0]);
    uint totalTradedAmount = _uints[0];
    if (_addresses[3] == 0) totalTradedAmount = _uints[1];
    // takerFee = takerFee * fillAmount / 1 ether
    uint takerFee = (_uints[6].mul(_uints[2])).div(1 ether);
    // makerGive = makerGive - fillAmount
    balances[_addresses[2]][_addresses[0]] = balances[_addresses[2]][_addresses[0]].sub(_uints[2]);
    // takerGive = takerGive + fillAmount - takerFee
    balances[_addresses[2]][_addresses[1]] = balances[_addresses[2]][_addresses[1]].add((_uints[2]).sub(takerFee));
    // feeGive = feeGive + takerFee
    balances[_addresses[2]][feeCollector] = balances[_addresses[2]][feeCollector].add(takerFee);
    // makerFee = makerFee * (takeAmount * fillAmount / giveAmount) / 1 ether
    uint makerFee = (_uints[5].mul(_uints[1].mul(_uints[2]).div(_uints[0]))).div(1 ether);
    if (!negativeFees) {
      // makerTake = makerTake + (takeAmount * fillAmount / giveAmount) - makerFee
      balances[_addresses[3]][_addresses[0]] = balances[_addresses[3]][_addresses[0]].add((_uints[1].mul(_uints[2]).div(_uints[0])).sub(makerFee));
      // feeTake = feeTake + makerFee
      balances[_addresses[3]][feeCollector] = balances[_addresses[3]][feeCollector].add(makerFee);
    } else {
      // makerTake = makerTake + (takeAmount * fillAmount / giveAmount) + makerFee
      balances[_addresses[3]][_addresses[0]] = balances[_addresses[3]][_addresses[0]].add((_uints[1].mul(_uints[2]).div(_uints[0])).add(makerFee));
    }
    // takerTake = takerTake - (takeAmount * fillAmount / giveAmount)
    balances[_addresses[3]][_addresses[1]] = balances[_addresses[3]][_addresses[1]].sub(_uints[1].mul(_uints[2]).div(_uints[0]));
    orderFills[orderHash] = orderFills[orderHash].add(_uints[2]);
  }
 
  function bulkCancelOrders(address _account, uint256 _nonce) public onlyServer {
    require(_nonce > cancelledOrders[_account]);
    cancelledOrders[_account] = _nonce;
  }

  function cancelOrder (bytes32 _hash) public onlyServer {
    cancelled[_hash] = true;
  }

  function recover(bytes32 _hash, uint8 v, bytes32 r, bytes32 s) private pure returns (address) {
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 hash = keccak256(abi.encodePacked(prefix, _hash));
    return ecrecover(hash, v, r, s);
  }
}

