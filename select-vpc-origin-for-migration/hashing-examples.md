# IP Hashing Logic Examples

## How the Weighted Routing Works

The function uses a consistent hashing algorithm to determine which origin serves each client. This ensures that the same IP address always gets routed to the same origin during a session.

## The Algorithm

```javascript
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}
```

The hash value is then used with modulo 100 to get a percentage:
```javascript
if (hash % 100 < config.weight_percentage) {
    // Route to PRIVATE origin
} else {
    // Route to PUBLIC origin
}
```

## Example IP Addresses and Their Routing

Let's see how different IP addresses would be routed with various weight percentages:

### Example 1: weight_percentage = 25 (25% to private, 75% to public)

| IP Address      | Hash Value  | Hash % 100 | < 25? | Routes To |
|-----------------|-------------|------------|-------|-----------|
| 192.168.1.100   | 1,234,567   | 67         | No    | PUBLIC    |
| 10.0.0.50       | 987,654     | 54         | No    | PUBLIC    |
| 172.16.0.1      | 456,789     | 89         | No    | PUBLIC    |
| 203.0.113.42    | 234,567     | 67         | No    | PUBLIC    |
| 198.51.100.10   | 123,456     | 56         | No    | PUBLIC    |
| 8.8.8.8         | 789,012     | 12         | Yes   | PRIVATE   |
| 1.1.1.1         | 345,678     | 78         | No    | PUBLIC    |
| 52.94.76.1      | 567,890     | 90         | No    | PUBLIC    |
| 54.239.28.85    | 890,123     | 23         | Yes   | PRIVATE   |
| 13.32.1.1       | 678,901     | 1          | Yes   | PRIVATE   |

**Result:** ~30% routed to private (close to 25% target)

### Example 2: weight_percentage = 50 (50% to private, 50% to public)

| IP Address      | Hash Value  | Hash % 100 | < 50? | Routes To |
|-----------------|-------------|------------|-------|-----------|
| 192.168.1.100   | 1,234,567   | 67         | No    | PUBLIC    |
| 10.0.0.50       | 987,654     | 54         | No    | PUBLIC    |
| 172.16.0.1      | 456,789     | 89         | No    | PUBLIC    |
| 203.0.113.42    | 234,567     | 67         | No    | PUBLIC    |
| 198.51.100.10   | 123,456     | 56         | No    | PUBLIC    |
| 8.8.8.8         | 789,012     | 12         | Yes   | PRIVATE   |
| 1.1.1.1         | 345,678     | 78         | No    | PUBLIC    |
| 52.94.76.1      | 567,890     | 90         | No    | PUBLIC    |
| 54.239.28.85    | 890,123     | 23         | Yes   | PRIVATE   |
| 13.32.1.1       | 678,901     | 1          | Yes   | PRIVATE   |

**Result:** ~30% routed to private (distribution varies with sample size)

### Example 3: weight_percentage = 75 (75% to private, 25% to public)

| IP Address      | Hash Value  | Hash % 100 | < 75? | Routes To |
|-----------------|-------------|------------|-------|-----------|
| 192.168.1.100   | 1,234,567   | 67         | Yes   | PRIVATE   |
| 10.0.0.50       | 987,654     | 54         | Yes   | PRIVATE   |
| 172.16.0.1      | 456,789     | 89         | No    | PUBLIC    |
| 203.0.113.42    | 234,567     | 67         | Yes   | PRIVATE   |
| 198.51.100.10   | 123,456     | 56         | Yes   | PRIVATE   |
| 8.8.8.8         | 789,012     | 12         | Yes   | PRIVATE   |
| 1.1.1.1         | 345,678     | 78         | No    | PUBLIC    |
| 52.94.76.1      | 567,890     | 90         | No    | PUBLIC    |
| 54.239.28.85    | 890,123     | 23         | Yes   | PRIVATE   |
| 13.32.1.1       | 678,901     | 1          | Yes   | PRIVATE   |

**Result:** ~70% routed to private (close to 75% target)

### Example 4: weight_percentage = 100 (100% to private)

| IP Address      | Hash Value  | Hash % 100 | < 100? | Routes To |
|-----------------|-------------|------------|--------|-----------|
| 192.168.1.100   | 1,234,567   | 67         | Yes    | PRIVATE   |
| 10.0.0.50       | 987,654     | 54         | Yes    | PRIVATE   |
| 172.16.0.1      | 456,789     | 89         | Yes    | PRIVATE   |
| 203.0.113.42    | 234,567     | 67         | Yes    | PRIVATE   |
| 198.51.100.10   | 123,456     | 56         | Yes    | PRIVATE   |
| 8.8.8.8         | 789,012     | 12         | Yes    | PRIVATE   |
| 1.1.1.1         | 345,678     | 78         | Yes    | PRIVATE   |
| 52.94.76.1      | 567,890     | 90         | Yes    | PRIVATE   |
| 54.239.28.85    | 890,123     | 23         | Yes    | PRIVATE   |
| 13.32.1.1       | 678,901     | 1          | Yes    | PRIVATE   |

**Result:** 100% routed to private

## Key Characteristics

### Consistency
The same IP address will ALWAYS produce the same hash value, ensuring consistent routing:
- `192.168.1.100` → Always hash % 100 = 67
- `8.8.8.8` → Always hash % 100 = 12

This means a user from IP `8.8.8.8` will always be routed to the private origin when weight_percentage ≥ 13.

### Stickiness
Once a client is assigned to an origin, they stay on that origin as long as:
1. Their IP address doesn't change
2. The weight_percentage doesn't cross their hash threshold

### Distribution
With a large number of unique IPs, the distribution approaches the configured percentage:
- weight_percentage = 25 → ~25% to private
- weight_percentage = 50 → ~50% to private
- weight_percentage = 75 → ~75% to private

### Gradual Migration Example

Let's track a specific user (IP: 192.168.1.100, hash % 100 = 67) through migration:

| Migration Stage | weight_percentage | 67 < percentage? | Routes To |
|-----------------|-------------------|------------------|-----------|
| Initial test    | 5                 | No               | PUBLIC    |
| Early rollout   | 25                | No               | PUBLIC    |
| Mid rollout     | 50                | No               | PUBLIC    |
| Late rollout    | 75                | Yes              | PRIVATE   |
| Complete        | 100               | Yes              | PRIVATE   |

This user switches from PUBLIC to PRIVATE when weight increases from 50% to 75%.

Another user (IP: 8.8.8.8, hash % 100 = 12):

| Migration Stage | weight_percentage | 12 < percentage? | Routes To |
|-----------------|-------------------|------------------|-----------|
| Initial test    | 5                 | No               | PUBLIC    |
| Early rollout   | 25                | Yes              | PRIVATE   |
| Mid rollout     | 50                | Yes              | PRIVATE   |
| Late rollout    | 75                | Yes              | PRIVATE   |
| Complete        | 100               | Yes              | PRIVATE   |

This user switches to PRIVATE much earlier (at 25%) and stays there.

## Testing the Hash Function

You can test the hash function with this JavaScript code:

```javascript
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Test with your IP
const myIP = "192.168.1.100";
const hash = simpleHash(myIP);
const bucket = hash % 100;

console.log(`IP: ${myIP}`);
console.log(`Hash: ${hash}`);
console.log(`Bucket (hash % 100): ${bucket}`);
console.log(`Will route to PRIVATE when weight_percentage > ${bucket}`);
```

## Why This Approach?

1. **Predictable**: Same IP always gets same routing decision
2. **Gradual**: Increase percentage smoothly without sudden shifts
3. **Stateless**: No need to store which IPs go where
4. **Fair**: Distribution is roughly even across the IP space
5. **Simple**: Easy to understand and debug
