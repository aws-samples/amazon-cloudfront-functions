# Origin Selection for VPC Migration

## Overview

This CloudFront Function enables gradual migration from public origins to private VPC origins by controlling traffic distribution through header-based routing or weighted traffic splitting. The function uses CloudFront Key Value Store (KVS) to dynamically configure routing behavior, allowing for safe testing and incremental rollout.

## Migration Strategy

This strategy involves creating a CloudFront edge function configured with VPC origins while maintaining your existing distribution with public origins. You control traffic distribution between the public and private VPC origins using edge functions and Key Value Store (KVS), allowing for gradual migration and easy rollback.

On the existing CloudFront distribution, add the created private VPC origin as an Origin. Then create a CloudFront Function with viewer-request trigger that directs the traffic to the VPC origin based on a custom header or weighted traffic split between public and private VPC origins.

## How It Works

The function supports two routing modes configured via KVS:

### 1. Header-Based Routing (`"mode": "header"`)

Routes traffic based on the `x-route-origin` custom header:
- `x-route-origin: public` → Routes to public origin
- `x-route-origin: private` → Routes to private VPC origin

This mode is ideal for initial testing, allowing you to tag specific requests and quickly resolve any issues during the testing phase.

### 2. Weighted Routing (`"mode": "weighted"`)

Distributes traffic based on a percentage split:
- Uses viewer IP hashing for consistent routing per client
- `weight_percentage` determines the percentage of traffic sent to private origin
- Example: `"weight_percentage": 5` sends 5% to private origin, 95% to public origin

#### How the Hashing Logic Works

The function uses a deterministic hashing algorithm to ensure consistent routing for each client:

1. **Hash Generation**: Each viewer's IP address is converted to a numeric hash value using a simple hash function
2. **Bucket Assignment**: The hash is reduced to a value between 0-99 using modulo operation (`hash % 100`)
3. **Routing Decision**: If the bucket value is less than `weight_percentage`, route to private origin; otherwise, route to public origin

**Example:**
```javascript
// IP: 192.168.1.100
// Hash: 1234567
// Bucket: 1234567 % 100 = 67

// With weight_percentage = 50:
// 67 < 50? No → Routes to PUBLIC origin

// With weight_percentage = 75:
// 67 < 75? Yes → Routes to PRIVATE origin
```

**Key Benefits:**
- **Consistency**: The same IP address always produces the same hash, ensuring users stay on the same origin
- **Stickiness**: Users don't flip-flop between origins during a session
- **Gradual Migration**: As you increase weight_percentage, different users gradually shift to the private origin
- **Stateless**: No need to store routing decisions; the hash function determines routing on every request

**Important Limitation:**
- The distribution is **approximate**, not exact. With a small number of unique IPs, the actual traffic split may differ from the configured percentage
- Example: With only 10 unique IPs, you might see 30% or 40% instead of exactly 25%
- The distribution becomes more accurate as the number of unique visitor IPs increases
- For production traffic with hundreds or thousands of unique IPs, the actual distribution will closely match your configured weight_percentage

**Migration Example:**
- At 25% weight: IPs with bucket values 0-24 go to private (25% of traffic)
- At 50% weight: IPs with bucket values 0-49 go to private (50% of traffic)
- At 75% weight: IPs with bucket values 0-74 go to private (75% of traffic)
- At 100% weight: All IPs go to private (100% of traffic)

For detailed examples with specific IP addresses and their routing behavior, see `hashing-examples.md`.

## Configuration

### Key Value Store Setup

The function reads configuration from KVS using the key `routing_mode`:

**Header mode:**
```json
{
  "mode": "header"
}
```

**Weighted mode:**
```json
{
  "mode": "weighted",
  "weight_percentage": 70
}
```

### Function Code

The function must be associated with a Key Value Store and deployed as a CloudFront Function with a viewer-request trigger.

**Important:** Before deploying, update these variables in the function code:
- `PUBLIC_ORIGIN_DOMAIN`: Your current public origin domain name (e.g., `my-elb.us-east-1.elb.amazonaws.com`)
- `PRIVATE_ORIGIN_ID`: The Origin ID of your private VPC origin as configured in CloudFront (e.g., `my-private-vpc-origin`)

You can find these values in your CloudFront distribution under the **Origins** tab.

## Migration Steps

### To migrate using edge functions (Console)

1. Open the CloudFront console at https://console.aws.amazon.com/cloudfront/

2. In the navigation pane, choose **Key Value Stores**, then choose **Create key value store**

3. For **Name**, enter a descriptive name (for example, `vpc-origin-migration-kvs`), then choose **Create key value store**

4. After creation, choose **Add key**, enter the required key value pairs:
   - Key: `routing_mode`
   - Value: `{"mode": "header"}`

5. In the navigation pane, choose **Functions**, then choose **Create function**

6. For **Function name**, enter a name (for example, `vpc-origin-migration-function`), then choose **Create function**

7. In the **Build** tab, copy the code from `OriginSelectionByHeader.js` and paste it into the function editor. **Important:** Update the configuration variables at the top of the code:
   - Replace `your-public-origin.example.com` with your actual public origin domain name
   - Replace `your-private-origin-id` with your actual private VPC origin ID (found in your distribution's Origins tab)

8. Choose **Save changes**

9. Scroll to **Associated key value stores**, choose **Add association**, select your KVS, then choose **Add**

10. Choose the **Test** tab, select **Viewer Request** for **Event type**, paste sample event data, then choose **Test function** to verify routing logic

11. Choose the **Publish** tab, review the function code, then choose **Publish function**

12. Navigate to **Distributions**, select your distribution, then choose the **Behaviors** tab

13. Select the cache behavior you want to modify and choose **Edit**

14. Scroll to **Function associations**, choose **CloudFront Functions** for **Viewer request**, select your published function, then choose **Save changes**

15. Wait for the distribution to deploy (status changes to **Deployed**)

16. Once 100% traffic routes successfully, edit your cache behavior to point the **Origin or origin group** directly to your private VPC origin and remove the function association

17. Choose **Save changes**, wait for deployment, then delete the CloudFront Function and Key Value Store if no longer needed

## Testing and Rollout Process

### Phase 1: Header-Based Testing

1. Set KVS to header mode:
   ```json
   {"mode": "header"}
   ```

2. Test with custom headers:
   ```bash
   # Test public origin
   curl -H "x-route-origin: public" https://your-distribution.cloudfront.net
   
   # Test private VPC origin
   curl -H "x-route-origin: private" https://your-distribution.cloudfront.net
   ```

3. Validate VPC, network, application performance and resolve any cosmetic issues

### Phase 2: Weighted Rollout

1. Start with 5% traffic to private origin:
   ```json
   {"mode": "weighted", "weight_percentage": 5}
   ```

2. Monitor metrics, logs, and error rates

3. Gradually increase weight_percentage:
   - 5% → 10% → 25% → 50% → 75% → 100%

4. At each step, validate performance and error rates

### Phase 3: Complete Migration

1. Once private origin receives 100% traffic successfully, update the cache behavior to use the private origin directly

2. Validate traffic is routed to private VPC origins

3. Remove the CloudFront function from the cache behavior

4. Repeat the process for other cache behaviors as needed

## Important Notes

- The function uses viewer IP hashing for weighted distribution to ensure consistent routing per client
  - Each IP address is hashed to a value between 0-99
  - The same IP always gets the same routing decision (sticky sessions)
  - As you increase weight_percentage, users gradually shift from public to private origin
  - **Note:** The traffic split is approximate and depends on having enough unique visitor IPs. With small traffic volumes, actual percentages may vary from the configured value
  - See `hashing-examples.md` for detailed examples of how specific IPs are routed
- **Before deploying:** Update `PUBLIC_ORIGIN_DOMAIN` and `PRIVATE_ORIGIN_ID` variables in the function code to match your actual origins
- Monitor CloudWatch metrics during migration to catch issues early
- Keep the function and KVS until all cache behaviors are migrated
- This approach allows for easy rollback by adjusting KVS values

## Additional Resources

- Additional examples can be viewed at [amazon-cloudfront-functions](https://github.com/aws-samples/amazon-cloudfront-functions) (aws-samples GitHub)
- For detailed IP hashing examples and routing behavior, see `hashing-examples.md`

## Function Code Example

See `VPCOriginSelectionByHeader.js` for the complete implementation.
